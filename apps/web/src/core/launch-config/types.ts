import type { BaseFeeMode } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type {
  BuildCurveBaseParams,
  ConfigParameters,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { QuoteToken } from '../quote-token'
import type { CurveShape } from './constants'

/** The curve part of a config: one SDK builder's own parameters, named by its shape. */
export type CurveSpec =
  | {
      curveShape: CurveShape.Standard
      percentageSupplyOnMigration: number
      /** Quote tokens the curve must collect to graduate. */
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

/**
 * Editable launch rules: the SDK's shared builder parameters, one curve, and the token the
 * launch is priced in (amounts and market caps are in that token). Plain JSON.
 */
export type LaunchConfig = BuildCurveBaseParams &
  CurveSpec & { quoteToken: QuoteToken }

export type CompiledLaunchConfig =
  | { ok: true; parameters: ConfigParameters; quoteToken: QuoteToken }
  | { ok: false; reason: string }

export interface LaunchPreset {
  id: string
  name: string
  /** What the preset is for, in plain language. */
  intent: string
  config: LaunchConfig
}

export type ScheduleMode =
  BaseFeeMode.FeeSchedulerLinear | BaseFeeMode.FeeSchedulerExponential

/** A fee that falls from `startingFeeBps` to `endingFeeBps` over a window; flat when the window is 0. */
export interface FeeSchedule {
  mode: ScheduleMode
  startingFeeBps: number
  endingFeeBps: number
  windowSeconds: number
}
