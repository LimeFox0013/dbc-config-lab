import type {
  Criterion,
  MeanMetrics,
  Objective,
  SearchCandidate,
} from '../../core/config-search'
import type { FeeSchedule, LaunchConfig } from '../../core/launch-config'
import type { ScenarioSpec } from '../../core/sniper-scenario'

/** A proposal's outcome relative to the flat-fee baseline, in SOL; positive = better for that party. */
export interface VersusFlat {
  humanProfit: number
  sniperProfit: number
  partnerCreatorFees: number
}

export interface Proposal {
  rank: number
  candidate: SearchCandidate
  versusFlat: VersusFlat
}

export interface Recommendation {
  proposals: Proposal[]
  flat: { schedule: FeeSchedule; metrics: MeanMetrics }
  /** Weighted criteria that could not rank the candidates in this launch situation. */
  undecided: Criterion[]
  /** The goal could not tell the candidates apart at all in this launch situation. */
  indistinguishable: boolean
}

export interface RecommendOptions {
  /** Also try other curve shapes and graduation thresholds, on a coarser fee grid. */
  includeCurves: boolean
}

/** A search request sent to the recommendation worker; `id` pairs it with its response. */
export interface RecommendRequest {
  id: number
  base: LaunchConfig
  objective: Objective
  scenario: ScenarioSpec
  options: RecommendOptions
}

export type RecommendResponse =
  | { id: number; ok: true; recommendation: Recommendation | null }
  | { id: number; ok: false; reason: string }
