import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, count, desc, eq } from 'drizzle-orm'
import { planLimits } from '../accounts'
import type { Account } from '../accounts'
import { accounts, DRIZZLE_DB, watchEvents, watches } from '../db'
import type { DrizzleDb } from '../db'
import { WATCH_TEXT, WatchKind } from './constants'
import type { NewWatch, WatchEventView, WatchView } from './types'
import { toWatchEventView, toWatchView } from './utils'

/** `watches`: an account's watches — never more than its plan allows — and their events. */
@Injectable()
export class WatchesService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async add(account: Account, watch: NewWatch): Promise<WatchView> {
    if (watch.kind === WatchKind.FeeWallet && watch.thresholdSol === undefined)
      throw new BadRequestException(WATCH_TEXT.thresholdRequired)
    // The account row is locked while counting, so concurrent adds cannot pass the limit together.
    const row = await this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, account.id))
        .for('update')
      if (!locked) throw new NotFoundException(WATCH_TEXT.notFound)
      const limit = planLimits(locked, new Date()).watches
      const [held] = await tx
        .select({ total: count() })
        .from(watches)
        .where(eq(watches.accountId, account.id))
      if ((held?.total ?? 0) >= limit)
        throw new BadRequestException(WATCH_TEXT.limitReached(limit))
      const [inserted] = await tx
        .insert(watches)
        .values({
          accountId: account.id,
          kind: watch.kind,
          target: watch.target,
          network: watch.network,
          thresholdSol:
            watch.kind === WatchKind.FeeWallet
              ? (watch.thresholdSol ?? null)
              : null,
        })
        .returning()
      return inserted
    })
    if (!row) throw new Error('Watch was not created')
    return toWatchView(row)
  }

  async list(accountId: string): Promise<WatchView[]> {
    const rows = await this.db
      .select()
      .from(watches)
      .where(eq(watches.accountId, accountId))
      .orderBy(asc(watches.createdAt))
    return rows.map(toWatchView)
  }

  async setPaused(
    accountId: string,
    watchId: string,
    paused: boolean,
  ): Promise<WatchView> {
    const [row] = await this.db
      .update(watches)
      .set({ paused })
      .where(and(eq(watches.id, watchId), eq(watches.accountId, accountId)))
      .returning()
    if (!row) throw new NotFoundException(WATCH_TEXT.notFound)
    return toWatchView(row)
  }

  async remove(accountId: string, watchId: string): Promise<void> {
    const deleted = await this.db
      .delete(watches)
      .where(and(eq(watches.id, watchId), eq(watches.accountId, accountId)))
      .returning({ id: watches.id })
    if (deleted.length === 0) throw new NotFoundException(WATCH_TEXT.notFound)
  }

  async events(accountId: string, limit: number): Promise<WatchEventView[]> {
    const rows = await this.db
      .select()
      .from(watchEvents)
      .where(eq(watchEvents.accountId, accountId))
      .orderBy(desc(watchEvents.seenAt))
      .limit(limit)
    return rows.map(toWatchEventView)
  }
}
