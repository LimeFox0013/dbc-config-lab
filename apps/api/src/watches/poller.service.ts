import { Inject, Injectable, Logger } from '@nestjs/common'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { errorMessage } from '@dbc-config-lab/core/core/shared'
import { and, asc, eq, lt, sql } from 'drizzle-orm'
import { PaymentsService } from '../accounts'
import {
  accounts,
  DatabaseService,
  DRIZZLE_DB,
  watchEvents,
  watches,
} from '../db'
import type { DrizzleDb } from '../db'
import { networkOf } from '../utils'
import { WebhooksService } from '../webhooks'
import { ChainService } from './chain.service'
import {
  POLL_INTERVAL_MS,
  POLLER_LOCK_KEY,
  WATCHES_PER_RUN,
  WatchKind,
} from './constants'
import type { WatchChange, WatchObservation, WatchRow } from './types'
import {
  configChanges,
  feeWalletChanges,
  isConfigState,
  isFeeWalletState,
  watchEventPayload,
  watchesAddedBeforeSql,
  watchLimitSql,
} from './utils'

/**
 * `watches` / `webhooks`: every few minutes, one run at a time across
 * replicas (a Postgres advisory lock), reads each active watch's target,
 * records what changed, queues deliveries, sends whatever is due, then
 * credits any recent payment whose transfer has since been finalized.
 */
@Injectable()
export class PollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PollerService.name)
  private timer: NodeJS.Timeout | undefined

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly database: DatabaseService,
    private readonly chain: ChainService,
    private readonly webhooks: WebhooksService,
    private readonly payments: PaymentsService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS)
  }

  onModuleDestroy(): void {
    clearInterval(this.timer)
  }

  /** One run, if no other instance is mid-run. */
  async tick(): Promise<void> {
    await this.database.sql.begin(async (tx) => {
      const [lock] =
        await tx`select pg_try_advisory_xact_lock(${POLLER_LOCK_KEY}) as acquired`
      if (!lock?.['acquired']) return
      await this.checkWatches()
      await this.webhooks.deliverDue()
      await this.payments.creditOpen()
    })
  }

  /** Checks the active watches within their account's current plan; a lapsed plan's extra watches wait. */
  async checkWatches(now = new Date()): Promise<number> {
    const due = (
      await this.db
        .select({ watch: watches })
        .from(watches)
        .innerJoin(accounts, eq(accounts.id, watches.accountId))
        .where(
          and(
            eq(watches.paused, false),
            lt(watchesAddedBeforeSql(), watchLimitSql(now)),
          ),
        )
        .orderBy(
          sql`${watches.lastCheckedAt} asc nulls first`,
          asc(watches.createdAt),
        )
        .limit(WATCHES_PER_RUN)
    ).map((row) => row.watch)
    for (const watch of due) {
      try {
        await this.check(watch)
      } catch (e) {
        this.logger.warn(`Watch ${watch.id} not checked (${errorMessage(e)})`)
      }
    }
    return due.length
  }

  /** Reads one watch's target, stores its state, and records each change once. */
  async check(watch: WatchRow): Promise<WatchChange[]> {
    const { state, changes } = await this.observe(watch)

    // The new state, its events and their deliveries commit together: an event is never recorded undelivered.
    await this.db.transaction(async (tx) => {
      await tx
        .update(watches)
        .set({ lastState: state, lastCheckedAt: new Date() })
        .where(eq(watches.id, watch.id))
      if (changes.length === 0) return
      const recorded = await tx
        .insert(watchEvents)
        .values(
          changes.map((change) => ({
            watchId: watch.id,
            accountId: watch.accountId,
            type: change.type,
            before: change.before,
            after: change.after,
          })),
        )
        .returning()
      for (const event of recorded) {
        await this.webhooks.enqueue(
          watch.accountId,
          event.id,
          watchEventPayload(watch, event),
          tx,
        )
      }
    })
    return changes
  }

  /** The watch's target as it is now, and what changed since the state it last stored. */
  private async observe(watch: WatchRow): Promise<WatchObservation> {
    const network = networkOf(watch.network)
    if (watch.kind === WatchKind.FeeWallet) {
      const after = await this.chain.feeWalletState(network, watch.target)
      return {
        state: after,
        changes: feeWalletChanges(
          isFeeWalletState(watch.lastState) ? watch.lastState : null,
          after,
          watch.thresholdSol ?? Number.POSITIVE_INFINITY,
        ),
      }
    }
    const after = await this.chain.configState(network, watch.target)
    return {
      state: after,
      changes: configChanges(
        isConfigState(watch.lastState) ? watch.lastState : null,
        after,
      ),
    }
  }
}
