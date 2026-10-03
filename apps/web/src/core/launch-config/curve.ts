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
import { QUOTE_TOKENS } from '../quote-token'
import type { QuoteToken } from '../quote-token'
import {
  CurveShape,
  DEFAULT_MARKET_CAPS,
  DEFAULT_WEIGHT_GROWTH,
  LIQUIDITY_WEIGHT_SEGMENTS,
  MIN_SHAPED_CURVE_LEFTOVER,
} from './constants'
import type { CurveSpec, LaunchConfig } from './types'

/** Weights where each segment holds `growth` times the liquidity of the one before. */
export const geometricWeights = (growth: number): number[] =>
  Array.from({ length: LIQUIDITY_WEIGHT_SEGMENTS }, (_, i) => growth ** i)

export const weightGrowthOf = (weights: number[]): number => {
  const [first, second] = weights
  return first !== undefined && second !== undefined && first > 0
    ? second / first
    : 1
}

/** The builder inputs; quote decimals always follow the config's quote token. */
const baseOf = (config: LaunchConfig): BuildCurveBaseParams => ({
  token: {
    ...config.token,
    tokenQuoteDecimal: QUOTE_TOKENS[config.quoteToken].decimals,
  },
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
  return { ...base, token, quoteToken: config.quoteToken, ...spec }
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

/** A curve's amounts (threshold, market caps) re-priced from one quote token to another. */
export const priceCurve = (
  curve: CurveSpec,
  from: QuoteToken,
  to: QuoteToken,
): CurveSpec => {
  const rate = QUOTE_TOKENS[from].solPerToken / QUOTE_TOKENS[to].solPerToken
  const converted = (amount: number): number => Math.round(amount * rate)
  return curve.curveShape === CurveShape.Standard
    ? {
        ...curve,
        migrationQuoteThreshold: converted(curve.migrationQuoteThreshold),
      }
    : {
        ...curve,
        initialMarketCap: converted(curve.initialMarketCap),
        migrationMarketCap: converted(curve.migrationMarketCap),
      }
}

/**
 * The same launch priced in another quote token: the threshold and market caps are
 * converted at the reference rate, so the launch stays the same size.
 */
export const withQuoteToken = (
  config: LaunchConfig,
  quoteToken: QuoteToken,
): LaunchConfig => ({
  ...withCurve(
    config,
    priceCurve(curveOf(config), config.quoteToken, quoteToken),
  ),
  quoteToken,
  token: {
    ...config.token,
    tokenQuoteDecimal: QUOTE_TOKENS[quoteToken].decimals,
  },
})
