import type { QuoteToken } from '../../core/quote-token'
import type { OnChainConfig } from '../onchain-config'
import type {
  AfterGraduationBasis,
  RELAXABLE_TERMS,
  CreatorShareBand,
  FeeShape,
  LaunchpadSort,
  ThresholdBand,
} from './constants'

/** A term a forecast may set aside when too few launchpads share it. */
export type RelaxableTerm = (typeof RELAXABLE_TERMS)[number]

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
  /** Null when the snapshot predates the measure. */
  afterGraduation: AfterGraduation | null
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

/** A launchpad's trading income after graduation, per graduated launch, in SOL. */
export type AfterGraduation =
  | { basis: AfterGraduationBasis.NoShare | AfterGraduationBasis.NotHeld }
  | {
      basis: AfterGraduationBasis.Positions
      sampledPositions: number
      median: number
      p75: number
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
    /** An `AfterGraduation`, added by the after-graduation script; absent from an older snapshot. */
    afterGraduation?: unknown
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
      /** The same range for income after graduation, from the comparables where it was measurable; null when none was. */
      afterGraduation: { low: number; high: number; launchpads: number } | null
      /** Terms set aside to find enough comparables, in the order they were dropped. */
      relaxed: RelaxableTerm[]
    }
  | { ok: false; comparables: number; minimum: number }
