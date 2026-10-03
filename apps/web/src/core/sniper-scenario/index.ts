export {
  DEFAULT_SCENARIO,
  SCENARIO_PRESETS,
  ScenarioPresetId,
  TraderGroup,
} from './constants'
export type {
  GroupOutcome,
  Range,
  ScenarioMetrics,
  ScenarioResult,
  ScenarioSpec,
} from './types'
export { generateTrades } from './utils'
export { metricsOf, runScenario, scenarioMetrics } from './scenario'
