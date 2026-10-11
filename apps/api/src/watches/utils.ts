import { and, eq, gt, lt, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { PLAN_LIMITS, PlanId } from '../accounts'
import { accounts, watches } from '../db'
import type { DeliveryPayload } from '../webhooks'
import { OLDER_WATCHES_ALIAS, WatchEventType, WatchKind } from './constants'
import type {
  ConfigState,
  FeeWalletState,
  WatchChange,
  WatchEventRow,
  WatchEventView,
  WatchRow,
  WatchView,
} from './types'

const sameRisks = (a: string[], b: string[]): boolean => {
  const sortedB = [...b].sort()
  return (
    a.length === b.length &&
    [...a].sort().every((risk, i) => risk === sortedB[i])
  )
}

/**
 * `watches`: the changes between two looks at a launch config. The first look
 * only sets the baseline — nothing has changed yet.
 */
export const configChanges = (
  before: ConfigState | null,
  after: ConfigState,
): WatchChange[] => {
  if (!before) return []
  const candidates: Array<WatchChange | null> = [
    after.totalPools > before.totalPools
      ? { type: WatchEventType.NewPool, before, after }
      : null,
    after.graduated > before.graduated
      ? { type: WatchEventType.Graduation, before, after }
      : null,
    sameRisks(before.risks, after.risks)
      ? null
      : { type: WatchEventType.RisksChanged, before, after },
  ]
  return candidates.filter((change): change is WatchChange => change !== null)
}

/**
 * `watches`: a fee wallet's unclaimed fees reaching the threshold — once per
 * crossing, so fees that stay above it are not reported again.
 */
export const feeWalletChanges = (
  before: FeeWalletState | null,
  after: FeeWalletState,
  thresholdSol: number,
): WatchChange[] =>
  after.unclaimedSol >= thresholdSol &&
  (before === null || before.unclaimedSol < thresholdSol)
    ? [{ type: WatchEventType.FeesAboveThreshold, before, after }]
    : []

export const isConfigState = (state: unknown): state is ConfigState =>
  typeof state === 'object' &&
  state !== null &&
  'totalPools' in state &&
  'graduated' in state &&
  'risks' in state

export const isFeeWalletState = (state: unknown): state is FeeWalletState =>
  typeof state === 'object' && state !== null && 'unclaimedSol' in state

/**
 * `watches` / `service-plans`: the account's watch limit as SQL over `accounts` —
 * the same rule as `effectivePlan` — for queries that filter by it.
 */
export const watchLimitSql = (now: Date): SQL =>
  sql`case when ${and(eq(accounts.paidPlan, PlanId.Pro), gt(accounts.planEndsAt, now))} then ${PLAN_LIMITS[PlanId.Pro].watches}::integer else ${PLAN_LIMITS[PlanId.Free].watches}::integer end`

const olderWatches = alias(watches, OLDER_WATCHES_ALIAS)

/**
 * `watches`: how many of its account's watches were added before this one (ties
 * broken by id), paused ones included — a watch is within the plan while this is
 * under the limit, so a lapsed plan keeps its oldest watches checked.
 */
export const watchesAddedBeforeSql = (): SQL =>
  sql`(select count(*) from ${watches} as ${sql.identifier(OLDER_WATCHES_ALIAS)} where ${and(
    eq(olderWatches.accountId, watches.accountId),
    or(
      lt(olderWatches.createdAt, watches.createdAt),
      and(
        eq(olderWatches.createdAt, watches.createdAt),
        lt(olderWatches.id, watches.id),
      ),
    ),
  )})`

/** A watch as its account sees it. */
export const toWatchView = (row: WatchRow): WatchView => ({
  id: row.id,
  kind:
    row.kind === WatchKind.FeeWallet ? WatchKind.FeeWallet : WatchKind.Config,
  target: row.target,
  network: row.network,
  thresholdSol: row.thresholdSol,
  paused: row.paused,
  lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
})

/** A recorded change as its account sees it. */
export const toWatchEventView = (row: WatchEventRow): WatchEventView => ({
  id: row.id,
  watchId: row.watchId,
  type: row.type,
  before: row.before,
  after: row.after,
  seenAt: row.seenAt.toISOString(),
})

/** `webhooks`: the body a recorded change is delivered with. */
export const watchEventPayload = (
  watch: Pick<WatchRow, 'id' | 'kind' | 'target' | 'network'>,
  event: WatchEventRow,
): DeliveryPayload => ({
  type: event.type,
  eventId: event.id,
  watch: {
    id: watch.id,
    kind: watch.kind,
    target: watch.target,
    network: watch.network,
  },
  before: event.before,
  after: event.after,
  seenAt: event.seenAt.toISOString(),
})
