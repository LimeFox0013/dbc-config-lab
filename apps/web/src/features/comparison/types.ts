import type {
  CompiledLaunchConfig,
  LaunchPreset,
} from '../../core/launch-config'
import type { ScenarioMetrics } from '../../core/sniper-scenario'

export type ComparisonMetrics = ScenarioMetrics

/** One config to compare: how it is labelled, and its compiled on-chain parameters. */
export interface ComparisonEntry {
  id: LaunchPreset['id']
  name: string
  intent: string
  compiled: CompiledLaunchConfig
}

/** The price after a trade, as a multiple of the config's opening price. */
export interface PricePoint {
  at: number
  multiple: number
}

export type ComparisonRow =
  | {
      entry: ComparisonEntry
      ok: true
      metrics: ComparisonMetrics
      path: PricePoint[]
    }
  | { entry: ComparisonEntry; ok: false; reason: string }
