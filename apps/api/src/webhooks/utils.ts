import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'node:crypto'
import { isRecord } from '@dbc-config-lab/core/core/shared'
import {
  DeliveryStatus,
  FIRST_RETRY_DELAY_MS,
  HASH_ALGORITHM,
  HTTPS_PROTOCOL,
  MAX_DELIVERY_ATTEMPTS,
  MS_PER_SECOND,
  SECRET_CIPHER,
  SECRET_IV_BYTES,
  SECRET_KEY_BYTES,
  SECRET_KEY_INFO,
  SUCCESS_STATUS_FIRST,
  SUCCESS_STATUS_LIMIT,
  TEST_EVENT_TYPE,
  WEBHOOK_TEXT,
} from './constants'
import type {
  AttemptRow,
  DeliveryProgress,
  DeliveryRow,
  DeliveryView,
  EndpointRow,
  EndpointView,
} from './types'

/** The key that encrypts stored webhook secrets, derived from the service's root secret. */
export const secretKey = (rootSecret: string): Buffer =>
  Buffer.from(
    hkdfSync(
      HASH_ALGORITHM,
      rootSecret,
      Buffer.alloc(0),
      SECRET_KEY_INFO,
      SECRET_KEY_BYTES,
    ),
  )

/** `iv.tag.ciphertext`, base64url each. */
export const encryptSecret = (secret: string, key: Buffer): string => {
  const iv = randomBytes(SECRET_IV_BYTES)
  const cipher = createCipheriv(SECRET_CIPHER, key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ])
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString('base64url'))
    .join('.')
}

export const decryptSecret = (stored: string, key: Buffer): string => {
  const [iv, tag, ciphertext] = stored
    .split('.')
    .map((part) => Buffer.from(part, 'base64url'))
  if (!iv || !tag || !ciphertext) throw new Error(WEBHOOK_TEXT.malformedSecret)
  const decipher = createDecipheriv(SECRET_CIPHER, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8')
}

/** `webhooks`: what a receiver recomputes to trust a delivery. */
export const signDelivery = (
  secret: string,
  timestamp: string,
  body: string,
): string =>
  `${HASH_ALGORITHM}=${createHmac(HASH_ALGORITHM, secret).update(`${timestamp}.${body}`).digest('hex')}`

/** A delivery's timestamp header: whole seconds since the epoch. */
export const unixTimestamp = (moment: Date): string =>
  String(Math.floor(moment.getTime() / MS_PER_SECOND))

/** When the next attempt is due after `attempts` failures: 30 s, then doubling. */
export const nextAttemptAt = (attempts: number, now: Date): Date =>
  new Date(
    now.getTime() + FIRST_RETRY_DELAY_MS * 2 ** Math.max(0, attempts - 1),
  )

export const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === HTTPS_PROTOCOL
  } catch {
    return false
  }
}

/** Whether a receiver accepted a delivery: any 2xx answer. */
export const isSuccessStatus = (status: number | null): boolean =>
  status !== null &&
  status >= SUCCESS_STATUS_FIRST &&
  status < SUCCESS_STATUS_LIMIT

/**
 * Where a delivery stands after its `attempts`-th attempt: delivered on a 2xx,
 * failed once the attempts run out, otherwise due again after a growing pause.
 */
export const deliveryProgress = (
  attempts: number,
  status: number | null,
  now: Date,
): DeliveryProgress => {
  if (isSuccessStatus(status))
    return {
      status: DeliveryStatus.Delivered,
      nextAttemptAt: null,
      deliveredAt: now,
    }
  if (attempts >= MAX_DELIVERY_ATTEMPTS)
    return {
      status: DeliveryStatus.Failed,
      nextAttemptAt: null,
      deliveredAt: null,
    }
  return {
    status: DeliveryStatus.Pending,
    nextAttemptAt: nextAttemptAt(attempts, now),
    deliveredAt: null,
  }
}

/** The event type a stored payload carries; a payload without one is a test. */
export const deliveryType = (payload: unknown): string =>
  isRecord(payload) && typeof payload['type'] === 'string'
    ? payload['type']
    : TEST_EVENT_TYPE

export const toEndpointView = (row: EndpointRow): EndpointView => ({
  id: row.id,
  url: row.url,
  createdAt: row.createdAt.toISOString(),
})

/** A delivery as its account sees it, with its own attempts picked out of `attempts`. */
export const toDeliveryView = (
  row: DeliveryRow,
  attempts: AttemptRow[],
): DeliveryView => ({
  id: row.id,
  endpointId: row.endpointId,
  eventId: row.eventId,
  type: deliveryType(row.payload),
  status: row.status,
  attempts: row.attempts,
  lastStatusCode: row.lastStatusCode,
  lastError: row.lastError,
  createdAt: row.createdAt.toISOString(),
  deliveredAt: row.deliveredAt?.toISOString() ?? null,
  attemptLog: attempts
    .filter((attempt) => attempt.deliveryId === row.id)
    .map((attempt) => ({
      attempt: attempt.attempt,
      statusCode: attempt.statusCode,
      error: attempt.error,
      attemptedAt: attempt.attemptedAt.toISOString(),
    })),
})
