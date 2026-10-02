import {
  CURVE_SEARCH_FEE_SPACE,
  DEFAULT_CURVE_VARIANTS,
  DEFAULT_SEARCH_SEEDS,
  DEFAULT_SEARCH_SPACE,
  searchConfigs,
} from '../../core/config-search'
import type {
  MeanMetrics,
  Objective,
  SearchCandidate,
} from '../../core/config-search'
import { FLAT_SCHEDULE, serializeLaunchConfig } from '../../core/launch-config'
import type { LaunchConfig, LaunchPreset } from '../../core/launch-config'
import type { ScenarioSpec } from '../../core/sniper-scenario'
import { PROPOSAL_COUNT } from './constants'
import type { Recommendation, RecommendOptions, VersusFlat } from './types'

export const versusFlat = (
  metrics: MeanMetrics,
  flat: MeanMetrics,
): VersusFlat => ({
  humanProfit: metrics.humanProfit - flat.humanProfit,
  sniperProfit: metrics.sniperProfit - flat.sniperProfit,
  partnerCreatorFees: metrics.partnerCreatorFees - flat.partnerCreatorFees,
})

/**
 * Best configs for the objective, each measured against a flat fee on the base config's
 * own curve under the same simulated launches.
 */
export const recommend = (
  base: LaunchConfig,
  objective: Objective,
  scenario: ScenarioSpec,
  options: RecommendOptions = { includeCurves: false },
): Recommendation | null => {
  const {
    candidates: ranked,
    undecided,
    indistinguishable,
  } = searchConfigs({
    base,
    objective,
    scenario,
    seeds: DEFAULT_SEARCH_SEEDS,
    space: options.includeCurves
      ? CURVE_SEARCH_FEE_SPACE
      : DEFAULT_SEARCH_SPACE,
    curves: options.includeCurves ? DEFAULT_CURVE_VARIANTS : [],
  })
  const flat = ranked.find(
    (candidate) =>
      candidate.schedule === FLAT_SCHEDULE && candidate.curve === null,
  )
  if (!flat) return null
  return {
    undecided,
    indistinguishable,
    flat: { schedule: flat.schedule, metrics: flat.metrics },
    proposals: ranked
      .slice(0, PROPOSAL_COUNT)
      .map((candidate: SearchCandidate, index) => ({
        rank: index + 1,
        candidate,
        versusFlat: versusFlat(candidate.metrics, flat.metrics),
      })),
  }
}

/** The built-in preset with exactly this config, if the search rediscovered one. */
export const matchingPreset = (
  config: LaunchConfig,
  presets: LaunchPreset[],
): LaunchPreset | undefined => {
  const document = serializeLaunchConfig(config)
  return presets.find(
    (preset) => serializeLaunchConfig(preset.config) === document,
  )
}
