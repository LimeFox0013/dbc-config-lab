import type BN from 'bn.js'
import type { RealLaunchesRejection } from './constants'

/** What one real pool on a config shows, in the quote token's base units. */
export interface PoolRecord {
  quoteReserve: BN
  /** Partner + creator trading fees over the pool's life, quote side. */
  tradingQuoteFees: BN
  /** Partner + creator trading fees taken in the launched token, valued at the pool's price. */
  tradingBaseFeesInQuote: BN
  traded: boolean
  completed: boolean
  migrated: boolean
  /** Seconds from activation to the curve completing; null if it has not, or time is in slots. */
  secondsToComplete: number | null
}

/** How the launches on one config actually went, figures in SOL. */
export interface RealLaunches {
  totalPools: number
  /** Pools the figures come from; fewer than the total when sampled. */
  sampledPools: number
  /** Shares 0–1 of the sampled pools. */
  completedShare: number
  migratedShare: number
  neverTradedShare: number
  tractionShare: number
  medianRaised: number
  meanRaised: number
  /** Partner + creator trading fees on the bonding curve, per pool: mean, median and 75th percentile. */
  meanCurveFees: number
  medianCurveFees: number
  p75CurveFees: number
  /** Over the pools that completed; null when none did or the config counts slots. */
  medianSecondsToComplete: number | null
}

export type RealLaunchesResult =
  | { ok: true; launches: RealLaunches }
  | { ok: false; rejection: RealLaunchesRejection; detail?: string }
