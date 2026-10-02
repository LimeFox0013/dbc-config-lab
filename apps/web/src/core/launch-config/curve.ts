import {
  buildCurve,
  buildCurveWithLiquidityWeights,
  buildCurveWithMarketCap,
  buildCurveWithTwoSegments,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type {
  BuildCurveBaseParams,
  ConfigParameters,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { CurveShape } from './constants'
import type { CurveSpec, LaunchConfig } from './types'

/** Market caps (SOL) at which every shape graduates near the 85 SOL standard baseline. */
export const DEFAULT_MARKET_CAPS = {
  initialMarketCap: 20,
  migrationMarketCap: 425,
} as const

/** Segment count and default growth for liquidity-weighted curves. */
export const LIQUIDITY_WEIGHT_SEGMENTS = 16
export const DEFAULT_WEIGHT_GROWTH = 1.1

/** Two-segment and weighted builders need a non-zero leftover buffer; 0.1% of a 1B supply. */
export const MIN_SHAPED_CURVE_LEFTOVER = 1_000_000

/** Weights where each segment holds `growth` times the liquidity of the one before. */
export const geometricWeights = (growth: number): number[] =>
  Array.from({ length: LIQUIDITY_WEIGHT_SEGMENTS }, (_, i) => growth ** i)

export const weightGrowthOf = (weights: number[]): number => {
  const [first, second] = weights
  return first !== undefined && second !== undefined && first > 0
    ? second / first
    : 1
}

const baseOf = (config: LaunchConfig): BuildCurveBaseParams => ({
  token: config.token,
  fee: config.fee,
  migration: config.migration,
  liquidityDistribution: config.liquidityDistribution,
  lockedVesting: config.lockedVesting,
  activationType: config.activationType,
})

/** Builds the on-chain parameters with the SDK builder for the config's curve shape. */
export const buildConfigParameters = (
  config: LaunchConfig,
): ConfigParameters => {
  const base = baseOf(config)
  switch (config.curveShape) {
    case CurveShape.Standard:
      return buildCurve({
        ...base,
        percentageSupplyOnMigration: config.percentageSupplyOnMigration,
        migrationQuoteThreshold: config.migrationQuoteThreshold,
      })
    case CurveShape.MarketCap:
      return buildCurveWithMarketCap({
        ...base,
        initialMarketCap: config.initialMarketCap,
        migrationMarketCap: config.migrationMarketCap,
      })
    case CurveShape.TwoSegments:
      return buildCurveWithTwoSegments({
        ...base,
        initialMarketCap: config.initialMarketCap,
        migrationMarketCap: config.migrationMarketCap,
        percentageSupplyOnMigration: config.percentageSupplyOnMigration,
      })
    case CurveShape.LiquidityWeights:
      return buildCurveWithLiquidityWeights({
        ...base,
        initialMarketCap: config.initialMarketCap,
        migrationMarketCap: config.migrationMarketCap,
        liquidityWeights: config.liquidityWeights,
      })
  }
}

/**
 * The config with its curve replaced by `spec`. Shapes whose builder needs a leftover
 * buffer get the minimum one if the config has none.
 */
export const withCurve = (
  config: LaunchConfig,
  spec: CurveSpec,
): LaunchConfig => {
  const base = baseOf(config)
  const needsBuffer =
    spec.curveShape === CurveShape.TwoSegments ||
    spec.curveShape === CurveShape.LiquidityWeights
  const token =
    needsBuffer && base.token.leftover < MIN_SHAPED_CURVE_LEFTOVER
      ? { ...base.token, leftover: MIN_SHAPED_CURVE_LEFTOVER }
      : base.token
  return { ...base, token, ...spec }
}

/** The curve part of a config. */
export const curveOf = (config: LaunchConfig): CurveSpec => {
  switch (config.curveShape) {
    case CurveShape.Standard:
      return {
        curveShape: config.curveShape,
        percentageSupplyOnMigration: config.percentageSupplyOnMigration,
        migrationQuoteThreshold: config.migrationQuoteThreshold,
      }
    case CurveShape.MarketCap:
      return {
        curveShape: config.curveShape,
        initialMarketCap: config.initialMarketCap,
        migrationMarketCap: config.migrationMarketCap,
      }
    case CurveShape.TwoSegments:
      return {
        curveShape: config.curveShape,
        initialMarketCap: config.initialMarketCap,
        migrationMarketCap: config.migrationMarketCap,
        percentageSupplyOnMigration: config.percentageSupplyOnMigration,
      }
    case CurveShape.LiquidityWeights:
      return {
        curveShape: config.curveShape,
        initialMarketCap: config.initialMarketCap,
        migrationMarketCap: config.migrationMarketCap,
        liquidityWeights: config.liquidityWeights,
      }
  }
}

/** A sensible starting curve for each shape, near the standard baseline's graduation. */
export const defaultCurve = (shape: CurveShape): CurveSpec => {
  switch (shape) {
    case CurveShape.Standard:
      return {
        curveShape: shape,
        percentageSupplyOnMigration: 20,
        migrationQuoteThreshold: 85,
      }
    case CurveShape.MarketCap:
      return { curveShape: shape, ...DEFAULT_MARKET_CAPS }
    case CurveShape.TwoSegments:
      return {
        curveShape: shape,
        ...DEFAULT_MARKET_CAPS,
        percentageSupplyOnMigration: 20,
      }
    case CurveShape.LiquidityWeights:
      return {
        curveShape: shape,
        ...DEFAULT_MARKET_CAPS,
        liquidityWeights: geometricWeights(DEFAULT_WEIGHT_GROWTH),
      }
  }
}
