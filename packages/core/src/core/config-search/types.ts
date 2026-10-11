import type {
  CurveSpec,
  FeeSchedule,
  LaunchConfig,
  ScheduleMode,
} from '../launch-config'
import type { ScenarioSpec } from '../sniper-scenario'
import type { Criterion } from './constants'

export interface SearchSpace {
  modes: ScheduleMode[]
  startingFeeBps: number[]
  windowSeconds: number[]
}

/** Non-negative weight per criterion; zero means the goal ignores it. */
export type Objective = Record<Criterion, number>

/** Scenario metrics averaged over the search seeds. */
export interface MeanMetrics {
  sniperProfit: number
  adaptiveSniperProfit: number
  humanProfit: number
  humanFees: number
  partnerCreatorFees: number
  postGraduationFees: number
  /** Share of seeds (0–1) in which the launch graduated. */
  graduationRate: number
  /** Mean seconds to graduate over the seeds that graduated; null when none did. */
  meanGraduationSeconds: number | null
  raised: number
  maxDrawdownPercent: number
  /** Mean over seeds with early buys; null when no seed had any. */
  botShareOfEarlyBuys: number | null
  /** What traders who know an outside price made; 0 in a situation without them. */
  arbitrageProfit: number
}

export interface CriterionDefinition {
  /** The candidate's raw value, or null when it has none (e.g. never graduated). */
  value: (metrics: MeanMetrics) => number | null
  higherIsBetter: boolean
}

export interface SearchCandidate {
  schedule: FeeSchedule
  /** The curve tried; null means the base config's own curve. */
  curve: CurveSpec | null
  config: LaunchConfig
  metrics: MeanMetrics
  /** 0–1: the weighted mean of the candidate's scaled criterion values. */
  score: number
}

export interface SearchResult {
  /** Best score first. */
  candidates: SearchCandidate[]
  /** Weighted criteria on which every candidate scored the same, so they could not rank. */
  undecided: Criterion[]
  /** True when every weighted criterion was undecided. */
  indistinguishable: boolean
}

export interface SearchRequest {
  base: LaunchConfig
  objective: Objective
  scenario: ScenarioSpec
  seeds: number[]
  space: SearchSpace
  /** Curves to try besides the base config's own; empty searches fee schedules only. */
  curves: CurveSpec[]
}
