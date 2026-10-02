import { BaseFeeMode } from '@meteora-ag/dynamic-bonding-curve-sdk'
import {
  CurveShape,
  DEFAULT_MARKET_CAPS,
  defaultCurve,
  geometricWeights,
} from '../launch-config'
import type { CurveSpec } from '../launch-config'
import type { SearchSpace } from './types'

/** Grid around the region the 2026-10-02 sweep found interesting. */
export const DEFAULT_SEARCH_SPACE: SearchSpace = {
  modes: [BaseFeeMode.FeeSchedulerLinear, BaseFeeMode.FeeSchedulerExponential],
  startingFeeBps: [2500, 5000, 7500, 9000],
  windowSeconds: [3, 5, 10, 20, 30, 60],
}

/** Coarser fee grid used when curves are searched too, keeping the search under a second. */
export const CURVE_SEARCH_FEE_SPACE: SearchSpace = {
  modes: [BaseFeeMode.FeeSchedulerLinear, BaseFeeMode.FeeSchedulerExponential],
  startingFeeBps: [5000, 9000],
  windowSeconds: [5, 10, 30],
}

/** Curves tried besides the user's own: other graduation thresholds and every shape. */
export const DEFAULT_CURVE_VARIANTS: CurveSpec[] = [
  {
    curveShape: CurveShape.Standard,
    percentageSupplyOnMigration: 20,
    migrationQuoteThreshold: 40,
  },
  {
    curveShape: CurveShape.Standard,
    percentageSupplyOnMigration: 20,
    migrationQuoteThreshold: 150,
  },
  defaultCurve(CurveShape.MarketCap),
  defaultCurve(CurveShape.TwoSegments),
  {
    curveShape: CurveShape.LiquidityWeights,
    ...DEFAULT_MARKET_CAPS,
    liquidityWeights: geometricWeights(0.9),
  },
  {
    curveShape: CurveShape.LiquidityWeights,
    ...DEFAULT_MARKET_CAPS,
    liquidityWeights: geometricWeights(1.1),
  },
]

export const DEFAULT_SEARCH_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/** The launch measures a goal can weigh. */
export enum Criterion {
  HumanOutcome = 'human-outcome',
  BotDeterrence = 'bot-deterrence',
  FeeIncome = 'fee-income',
  Graduation = 'graduation',
  Raise = 'raise',
  PriceStability = 'price-stability',
  EarlyFairness = 'early-fairness',
}

/** Graduation scores rate × 1 / (1 + seconds / this), so faster graduation scores higher. */
export const GRADUATION_SPEED_SCALE_SECONDS = 600

/**
 * Spreads smaller than this fraction of the values' magnitude are rounding noise (e.g.
 * lamports left by a final partial fill), not a difference worth ranking on.
 */
export const RELATIVE_SPREAD_TOLERANCE = 1e-6
