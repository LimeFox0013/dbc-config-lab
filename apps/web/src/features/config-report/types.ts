import type { ConfigTerms } from '../../core/config-deploy'
import type { RoyaltySplit } from '../../core/preset-royalty'
import type { SolanaNetwork } from '../../core/shared'
import type {
  ScenarioMetrics,
  ScenarioPresetId,
} from '../../core/sniper-scenario'
import type { RealLaunches, RealLaunchesRejection } from '../real-launches'
import type { ReportRisk, TokenHolder } from './constants'

export type ReportFinding =
  | {
      risk: ReportRisk.LiquidityPullable
      /** Shares of graduation liquidity neither locked nor vesting, 0–100. */
      partnerPercent: number
      creatorPercent: number
    }
  | { risk: ReportRisk.MintAuthorityKept; holder: TokenHolder }
  | { risk: ReportRisk.MetadataMutable; holder: TokenHolder }
  | { risk: ReportRisk.NoAutoGraduation }
  | { risk: ReportRisk.RefusedToday; reason: string }

/** How the real launches on the config went, read from chain; null when not read yet. */
export type ReportRealLaunches =
  | { read: true; launches: RealLaunches }
  | { read: false; rejection: RealLaunchesRejection; detail?: string }
  | null

/** One run of a stated launch situation against the config. */
export type ReportSimulation =
  | { situation: ScenarioPresetId; seed: number; metrics: ScenarioMetrics }
  | { situation: ScenarioPresetId; seed: number; unsupported: string }

/** Everything the report states, as data: what the page shows and what it downloads. */
export interface ConfigReport {
  version: number
  configAddress: string
  poolAddress: string | null
  network: SolanaNetwork
  feeClaimer: string
  /** Published by the fee wallet itself; never verified. */
  branding: { name: string; website: string | null; verified: false } | null
  royalty: RoyaltySplit | null
  terms: ConfigTerms
  risks: ReportFinding[]
  real: ReportRealLaunches
  simulated: ReportSimulation
}
