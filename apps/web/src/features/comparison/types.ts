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

export type ComparisonRow =
  | { entry: ComparisonEntry; ok: true; metrics: ComparisonMetrics }
  | { entry: ComparisonEntry; ok: false; reason: string }
