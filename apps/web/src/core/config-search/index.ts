import {
  compileLaunchConfig,
  priceCurve,
  withCurve,
  withSchedule,
} from '../launch-config'
import { QuoteToken } from '../quote-token'
import type { CurveSpec, FeeSchedule, LaunchConfig } from '../launch-config'
import { scenarioMetrics } from '../sniper-scenario'
import type { MeanMetrics, SearchRequest, SearchResult } from './types'
import {
  enumerateSchedules,
  meanMetrics,
  sanitizeObjective,
  scoreCandidates,
} from './utils'

export {
  Criterion,
  CURVE_SEARCH_FEE_SPACE,
  DEFAULT_CURVE_VARIANTS,
  DEFAULT_SEARCH_SEEDS,
  DEFAULT_SEARCH_SPACE,
} from './constants'
export type {
  MeanMetrics,
  Objective,
  SearchCandidate,
  SearchRequest,
  SearchResult,
  SearchSpace,
} from './types'
export { botProfit, CRITERIA, objectiveOf, sanitizeObjective } from './utils'

interface Measured {
  schedule: FeeSchedule
  curve: CurveSpec | null
  config: LaunchConfig
  metrics: MeanMetrics
}

/**
 * Simulates every fee schedule in the space — on the base curve and on each extra curve —
 * against the scenario over each seed, and ranks them by the objective, best first.
 * Combinations the program would reject or the simulator cannot reproduce are left out,
 * so every ranked figure is a simulated one.
 */
export const searchConfigs = (request: SearchRequest): SearchResult => {
  // Curve variants are written in SOL; a base config priced otherwise gets them re-priced.
  const curves: Array<CurveSpec | null> = [
    null,
    ...request.curves.map((curve) =>
      priceCurve(curve, QuoteToken.Sol, request.base.quoteToken),
    ),
  ]
  const pairs = enumerateSchedules(request.space).flatMap((schedule) =>
    curves.map((curve) => ({ schedule, curve })),
  )
  const measured = pairs.flatMap(({ schedule, curve }): Measured[] => {
    const config = withSchedule(
      curve ? withCurve(request.base, curve) : request.base,
      schedule,
    )
    const compiled = compileLaunchConfig(config)
    if (!compiled.ok) return []
    const metrics = meanMetrics(
      request.seeds.map((seed) =>
        scenarioMetrics(
          compiled.parameters,
          { ...request.scenario, seed },
          compiled.quoteToken,
        ),
      ),
    )
    return [{ schedule, curve, config, metrics }]
  })
  const { scores, undecided, indistinguishable } = scoreCandidates(
    measured.map((m) => m.metrics),
    sanitizeObjective(request.objective),
  )
  const candidates = measured
    .map((m, i) => ({ ...m, score: scores[i] ?? 0 }))
    .sort((a, b) => b.score - a.score)
  return { candidates, undecided, indistinguishable }
}
