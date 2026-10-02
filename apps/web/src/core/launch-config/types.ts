import type {
  BuildCurveBaseParams,
  ConfigParameters,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { CurveShape } from './constants'

/** The curve part of a config: one SDK builder's own parameters, named by its shape. */
export type CurveSpec =
  | {
      curveShape: CurveShape.Standard
      percentageSupplyOnMigration: number
      /** SOL the curve must collect to graduate. */
      migrationQuoteThreshold: number
    }
  | {
      curveShape: CurveShape.MarketCap
      initialMarketCap: number
      migrationMarketCap: number
    }
  | {
      curveShape: CurveShape.TwoSegments
      initialMarketCap: number
      migrationMarketCap: number
      percentageSupplyOnMigration: number
    }
  | {
      curveShape: CurveShape.LiquidityWeights
      initialMarketCap: number
      migrationMarketCap: number
      /** Up to 16 segment weights. */
      liquidityWeights: number[]
    }

/** Editable launch rules: the SDK's shared builder parameters plus one curve. Plain JSON. */
export type LaunchConfig = BuildCurveBaseParams & CurveSpec

export type CompiledLaunchConfig =
  { ok: true; parameters: ConfigParameters } | { ok: false; reason: string }

export interface LaunchPreset {
  id: string
  name: string
  /** What the preset is for, in plain language. */
  intent: string
  config: LaunchConfig
}
