/** `watches`: what can be watched. */
export enum WatchKind {
  Config = 'config',
  FeeWallet = 'fee-wallet',
}

/** `watches`: the changes a watch reports. */
export enum WatchEventType {
  NewPool = 'new-pool',
  Graduation = 'graduation',
  RisksChanged = 'risks-changed',
  FeesAboveThreshold = 'fees-above-threshold',
}

/** How often the poller runs; each run checks every active watch once. */
export const POLL_INTERVAL_MS = 3 * 60 * 1000

/** A Postgres advisory-lock key: only one poller run at a time, across replicas. */
export const POLLER_LOCK_KEY = 4_712_001

/** Watches checked per run at most, oldest-checked first. */
export const WATCHES_PER_RUN = 200

/** Events and deliveries listed per request at most, newest first. */
export const LIST_LIMIT = 100

/** The highest fee-wallet threshold accepted, in SOL. */
export const MAX_THRESHOLD_SOL = 1_000_000

/** The SQL alias for the account's other watches when counting those added before one. */
export const OLDER_WATCHES_ALIAS = 'older_watches'

export const WATCH_TEXT = {
  limitReached: (limit: number): string =>
    `This account's plan allows ${limit} watches, paused ones included; delete one first, or move to a paid plan.`,
  notFound: 'No such watch on this account.',
  thresholdRequired: 'A fee-wallet watch needs a threshold in SOL.',
} as const
