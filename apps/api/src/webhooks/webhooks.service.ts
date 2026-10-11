import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { safeFetch, sanitizeUrl } from '@lf/safe-fetch'
import { and, asc, count, desc, eq, inArray, lte } from 'drizzle-orm'
import {
  DRIZZLE_DB,
  webhookAttempts,
  webhookDeliveries,
  webhookEndpoints,
} from '../db'
import type { DrizzleDb, DrizzleTx } from '../db'
import { CALLER_HASH_KEY_ENV } from '../usage'
import { requiredEnv } from '../utils'
import {
  DELIVERIES_PER_RUN,
  DeliveryStatus,
  JSON_CONTENT_TYPE,
  MAX_ENDPOINTS_PER_ACCOUNT,
  TEST_EVENT_TYPE,
  WEBHOOK_SECRET_BYTES,
  WEBHOOK_SECRET_PREFIX,
  WEBHOOK_TEXT,
  WebhookHeader,
} from './constants'
import type {
  AttemptRow,
  DeliveryPayload,
  DeliveryRow,
  DeliveryView,
  EndpointView,
  RegisteredEndpoint,
  SendOutcome,
} from './types'
import {
  decryptSecret,
  deliveryProgress,
  deliveryType,
  encryptSecret,
  isHttpsUrl,
  secretKey,
  signDelivery,
  toDeliveryView,
  toEndpointView,
  unixTimestamp,
} from './utils'

/**
 * `webhooks`: an account's delivery addresses and every delivery to them —
 * signed, https and public addresses only, retried with growing pauses.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name)
  private readonly key: Buffer

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {
    this.key = secretKey(requiredEnv(CALLER_HASH_KEY_ENV))
  }

  /** Registers an address; its signing secret is returned this once only. */
  async register(accountId: string, url: string): Promise<RegisteredEndpoint> {
    if (!isHttpsUrl(url)) throw new BadRequestException(WEBHOOK_TEXT.httpsOnly)
    if (await sanitizeUrl(url))
      throw new BadRequestException(WEBHOOK_TEXT.privateAddress)
    const [existing] = await this.db
      .select({ total: count() })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.accountId, accountId))
    if ((existing?.total ?? 0) >= MAX_ENDPOINTS_PER_ACCOUNT)
      throw new BadRequestException(WEBHOOK_TEXT.limitReached)

    const secret = `${WEBHOOK_SECRET_PREFIX}${randomBytes(WEBHOOK_SECRET_BYTES).toString('base64url')}`
    const [row] = await this.db
      .insert(webhookEndpoints)
      .values({
        accountId,
        url,
        secretCiphertext: encryptSecret(secret, this.key),
      })
      .returning()
    if (!row) throw new Error('Endpoint was not created')
    return { secret, endpoint: toEndpointView(row) }
  }

  async list(accountId: string): Promise<EndpointView[]> {
    const rows = await this.db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.accountId, accountId))
      .orderBy(asc(webhookEndpoints.createdAt))
    return rows.map(toEndpointView)
  }

  async remove(accountId: string, endpointId: string): Promise<void> {
    const deleted = await this.db
      .delete(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, endpointId),
          eq(webhookEndpoints.accountId, accountId),
        ),
      )
      .returning({ id: webhookEndpoints.id })
    if (deleted.length === 0) throw new NotFoundException(WEBHOOK_TEXT.notFound)
  }

  /**
   * Queues one delivery per address of the account (`eventId` null for a test);
   * pass the caller's transaction so an event and its deliveries commit together.
   */
  async enqueue(
    accountId: string,
    eventId: string | null,
    payload: DeliveryPayload,
    executor: DrizzleDb | DrizzleTx = this.db,
  ): Promise<number> {
    const endpoints = await executor
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.accountId, accountId))
    if (endpoints.length === 0) return 0
    await executor.insert(webhookDeliveries).values(
      endpoints.map((endpoint) => ({
        endpointId: endpoint.id,
        eventId,
        payload,
        status: DeliveryStatus.Pending,
        nextAttemptAt: new Date(),
      })),
    )
    return endpoints.length
  }

  /** A test event to one of the account's addresses, sent at once. */
  async sendTest(accountId: string, endpointId: string): Promise<DeliveryView> {
    const [endpoint] = await this.db
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, endpointId),
          eq(webhookEndpoints.accountId, accountId),
        ),
      )
    if (!endpoint) throw new NotFoundException(WEBHOOK_TEXT.notFound)
    const [delivery] = await this.db
      .insert(webhookDeliveries)
      .values({
        endpointId,
        eventId: null,
        payload: { type: TEST_EVENT_TYPE, sentAt: new Date().toISOString() },
        status: DeliveryStatus.Pending,
        nextAttemptAt: new Date(),
      })
      .returning()
    if (!delivery) throw new Error('Delivery was not created')
    const sent = await this.attempt(delivery.id)
    return toDeliveryView(sent, await this.attemptsOf([sent.id]))
  }

  /** The account's delivery log, newest first. */
  async deliveries(accountId: string, limit: number): Promise<DeliveryView[]> {
    const rows = await this.db
      .select({ delivery: webhookDeliveries })
      .from(webhookDeliveries)
      .innerJoin(
        webhookEndpoints,
        eq(webhookDeliveries.endpointId, webhookEndpoints.id),
      )
      .where(eq(webhookEndpoints.accountId, accountId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit)
    const attempts = await this.attemptsOf(
      rows.map(({ delivery }) => delivery.id),
    )
    return rows.map(({ delivery }) => toDeliveryView(delivery, attempts))
  }

  /** The attempts of these deliveries, oldest first. */
  private async attemptsOf(deliveryIds: string[]): Promise<AttemptRow[]> {
    if (deliveryIds.length === 0) return []
    return this.db
      .select()
      .from(webhookAttempts)
      .where(inArray(webhookAttempts.deliveryId, deliveryIds))
      .orderBy(asc(webhookAttempts.attempt))
  }

  /** Sends every delivery that is due; called by the poller. */
  async deliverDue(now = new Date()): Promise<number> {
    const due = await this.db
      .select({ id: webhookDeliveries.id })
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.status, DeliveryStatus.Pending),
          lte(webhookDeliveries.nextAttemptAt, now),
        ),
      )
      .orderBy(asc(webhookDeliveries.nextAttemptAt))
      .limit(DELIVERIES_PER_RUN)
    for (const { id } of due) await this.attempt(id)
    return due.length
  }

  /** One attempt at a delivery, recorded — in the delivery and in its attempt log — whatever the outcome. */
  private async attempt(deliveryId: string): Promise<DeliveryRow> {
    const [row] = await this.db
      .select({ delivery: webhookDeliveries, endpoint: webhookEndpoints })
      .from(webhookDeliveries)
      .innerJoin(
        webhookEndpoints,
        eq(webhookDeliveries.endpointId, webhookEndpoints.id),
      )
      .where(eq(webhookDeliveries.id, deliveryId))
    if (!row) throw new NotFoundException(WEBHOOK_TEXT.notFound)
    const { delivery, endpoint } = row

    const body = JSON.stringify(delivery.payload)
    const timestamp = unixTimestamp(new Date())
    const outcome = await this.send(
      endpoint.url,
      {
        [WebhookHeader.ContentType]: JSON_CONTENT_TYPE,
        [WebhookHeader.Event]: deliveryType(delivery.payload),
        [WebhookHeader.Timestamp]: timestamp,
        [WebhookHeader.Signature]: signDelivery(
          decryptSecret(endpoint.secretCiphertext, this.key),
          timestamp,
          body,
        ),
      },
      body,
    )

    const attempts = delivery.attempts + 1
    const now = new Date()
    const updated = await this.db.transaction(async (tx) => {
      await tx.insert(webhookAttempts).values({
        deliveryId,
        attempt: attempts,
        statusCode: outcome.status,
        error: outcome.error,
        attemptedAt: now,
      })
      const [row] = await tx
        .update(webhookDeliveries)
        .set({
          attempts,
          lastStatusCode: outcome.status,
          lastError: outcome.error,
          ...deliveryProgress(attempts, outcome.status, now),
        })
        .where(eq(webhookDeliveries.id, deliveryId))
        .returning()
      return row
    })
    return updated ?? delivery
  }

  /** POSTs to a public https address only; the address is re-checked at sending time. */
  protected async send(
    url: string,
    headers: Record<string, string>,
    body: string,
  ): Promise<SendOutcome> {
    if (!isHttpsUrl(url)) return { status: null, error: WEBHOOK_TEXT.httpsOnly }
    try {
      const response = await safeFetch(url, {
        method: 'POST',
        headers,
        body,
        redirect: 'manual',
      })
      if ('code' in response)
        return { status: null, error: WEBHOOK_TEXT.privateAddress }
      return {
        status: response.status,
        error: response.ok ? null : WEBHOOK_TEXT.httpStatus(response.status),
      }
    } catch (e) {
      this.logger.warn(
        `Webhook delivery failed (${e instanceof Error ? e.name : 'unknown error'})`,
      )
      return {
        status: null,
        error: e instanceof Error ? e.message : WEBHOOK_TEXT.deliveryFailed,
      }
    }
  }
}
