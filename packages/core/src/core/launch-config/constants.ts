import { PublicKey } from '@solana/web3.js'
import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  MigratedCollectFeeMode,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { QUOTE_TOKENS, QuoteToken } from '../quote-token'
import type { FeeSchedule, LaunchConfig } from './types'

export const SOL_DECIMALS = QUOTE_TOKENS[QuoteToken.Sol].decimals

export enum CurveShape {
  Standard = 'standard',
  MarketCap = 'market-cap',
  TwoSegments = 'two-segments',
  LiquidityWeights = 'liquidity-weights',
}

/** Curve shapes in display order; the editor's shape picker uses the index as its value. */
export const CURVE_SHAPE_ORDER = [
  CurveShape.Standard,
  CurveShape.MarketCap,
  CurveShape.TwoSegments,
  CurveShape.LiquidityWeights,
] as const

/** The SDK options a launch config may use, in display order — what the editor offers and a shared link may carry. */
export const TOKEN_DECIMAL_OPTIONS: readonly TokenDecimal[] = [
  TokenDecimal.SIX,
  TokenDecimal.SEVEN,
  TokenDecimal.EIGHT,
  TokenDecimal.NINE,
]
export const COLLECT_FEE_MODE_OPTIONS: readonly CollectFeeMode[] = [
  CollectFeeMode.QuoteToken,
  CollectFeeMode.OutputToken,
]
export const MIGRATION_FEE_OPTIONS: readonly MigrationFeeOption[] = [
  MigrationFeeOption.FixedBps25,
  MigrationFeeOption.FixedBps30,
  MigrationFeeOption.FixedBps100,
  MigrationFeeOption.FixedBps200,
  MigrationFeeOption.FixedBps400,
  MigrationFeeOption.FixedBps600,
  MigrationFeeOption.Customizable,
]
export const MIGRATED_COLLECT_FEE_MODE_OPTIONS: readonly MigratedCollectFeeMode[] =
  [
    MigratedCollectFeeMode.QuoteToken,
    MigratedCollectFeeMode.OutputToken,
    MigratedCollectFeeMode.Compounding,
  ]

/** The standard curve's baseline: graduate at 85 quote tokens with 20% of the supply left for migration. */
export const DEFAULT_SUPPLY_ON_MIGRATION_PERCENT = 20
export const DEFAULT_MIGRATION_QUOTE_THRESHOLD = 85

/** The flat fee most launchpads charge. */
export const FLAT_FEE_BPS = 100

export const FLAT_SCHEDULE: FeeSchedule = {
  mode: BaseFeeMode.FeeSchedulerLinear,
  startingFeeBps: FLAT_FEE_BPS,
  endingFeeBps: FLAT_FEE_BPS,
  windowSeconds: 0,
}

/** A pump.fun-like baseline: 1B supply, 85 SOL graduation, flat 1% fee. */
export const DEFAULT_LAUNCH_CONFIG: LaunchConfig = {
  token: {
    tokenType: TokenType.SPLToken,
    tokenBaseDecimal: TokenDecimal.SIX,
    tokenQuoteDecimal: SOL_DECIMALS,
    tokenAuthorityOption: TokenAuthorityOption.Immutable,
    totalTokenSupply: 1_000_000_000,
    leftover: 0,
  },
  fee: {
    baseFeeParams: {
      baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
      feeSchedulerParam: {
        startingFeeBps: FLAT_FEE_BPS,
        endingFeeBps: FLAT_FEE_BPS,
        numberOfPeriod: 0,
        totalDuration: 0,
      },
    },
    dynamicFeeEnabled: false,
    collectFeeMode: CollectFeeMode.QuoteToken,
    creatorTradingFeePercentage: 50,
    poolCreationFee: 0,
    enableFirstSwapWithMinFee: false,
  },
  migration: {
    migrationOption: MigrationOption.MET_DAMM_V2,
    migrationFeeOption: MigrationFeeOption.FixedBps100,
    migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
  },
  liquidityDistribution: {
    partnerLiquidityPercentage: 0,
    partnerPermanentLockedLiquidityPercentage: 50,
    creatorLiquidityPercentage: 0,
    creatorPermanentLockedLiquidityPercentage: 50,
  },
  lockedVesting: {
    totalLockedVestingAmount: 0,
    numberOfVestingPeriod: 0,
    cliffUnlockAmount: 0,
    totalVestingDuration: 0,
    cliffDurationFromMigrationTime: 0,
  },
  activationType: ActivationType.Timestamp,
  quoteToken: QuoteToken.Sol,
  curveShape: CurveShape.Standard,
  percentageSupplyOnMigration: DEFAULT_SUPPLY_ON_MIGRATION_PERCENT,
  migrationQuoteThreshold: DEFAULT_MIGRATION_QUOTE_THRESHOLD,
}

/**
 * Stand-in leftover receiver for validation: the SDK's checks need one other than the
 * default key. The real one is the deployer's wallet, set at deployment, where
 * `createConfig` runs the checks again.
 */
export const VALIDATION_LEFTOVER_RECEIVER = new PublicKey(1)

/** Segment count and default growth for liquidity-weighted curves. */
export const LIQUIDITY_WEIGHT_SEGMENTS = 16
export const DEFAULT_WEIGHT_GROWTH = 1.1

/** Two-segment and weighted builders need a non-zero leftover buffer; 0.1% of a 1B supply. */
export const MIN_SHAPED_CURVE_LEFTOVER = 1_000_000

/** Market caps (in the quote token; SOL here) at which every shape graduates near the 85 SOL standard baseline. */
export const DEFAULT_MARKET_CAPS = {
  initialMarketCap: 20,
  migrationMarketCap: 425,
} as const

/** The built-in presets. */
export enum LaunchPresetId {
  Flat = 'flat',
  SniperShield = 'sniper-shield',
  SoftOpen = 'soft-open',
  LongTax = 'long-tax',
  StockListing = 'stock-listing',
}

/** Configs the user made rather than picked: edited, opened from a link, or recommended. */
export enum UserPresetId {
  Custom = 'custom',
  Shared = 'shared',
  Recommended = 'recommended',
}
