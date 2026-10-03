import type { QuoteToken } from '../../core/quote-token'
import type { OnChainConfig } from '../onchain-config'
import type {
  CreatorShareBand,
  FeeShape,
  LaunchpadSort,
  ThresholdBand,
} from './constants'

/** The terms a launchpad is grouped by — the "niche" a builder picks. */
export interface Archetype {
  quoteToken: QuoteToken
  thresholdBand: ThresholdBand
  feeShape: FeeShape
  creatorShare: CreatorShareBand
}

/** One real launchpad config and what its launches did, as of the snapshot. */
export interface LaunchpadRecord {
  config: OnChainConfig
  archetype: Archetype
  launches: number
  graduated: number
  /** Pools the per-launch figures rest on. */
  sampledPools: number
  neverTradedShare: number
  medianSecondsToComplete: number | null
  /** The fee claimer's bonding-curve fees per launch, SOL: median and 75th percentile. */
  partnerIncomeMedian: number
  partnerIncomeP75: number
  /** When the record was read, YYYY-MM-DD. */
  takenAt: string
}

export interface LaunchpadFilter {
  quoteToken?: QuoteToken
  thresholdBand?: ThresholdBand
  feeShape?: FeeShape
  creatorShare?: CreatorShareBand
}

export interface LaunchpadQuery {
  sort: LaunchpadSort
  filter: LaunchpadFilter
}

/** The snapshot file the build script writes. */
export interface LaunchpadSnapshot {
  takenAt: string
  launchpads: Array<{
    configAddress: string
    graduated: number
    launches: number
    sampledPools: number
    completedShare: number
    neverTradedShare: number
    medianSecondsToComplete: number | null
    meanCurveFees: number
    medianCurveFees: number
    p75CurveFees: number
    configBase64: string
  }>
}

/** What comparable launchpads earned, scaled to a number of launches; curve fees only, in SOL. */
export type IncomeForecast =
  | {
      ok: true
      low: number
      high: number
      /** Comparable launchpads, and the launches they made between them. */
      launchpads: number
      launches: number
      takenAt: string
    }
  | { ok: false; comparables: number; minimum: number }
