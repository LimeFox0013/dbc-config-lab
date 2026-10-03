import { CurveShape } from '../../core/launch-config'

export enum FieldKind {
  Number = 'number',
  Select = 'select',
}

export enum FieldUnit {
  Tokens = 'tokens',
  Percent = 'percent',
  /** Amounts in the config's own quote token. */
  Quote = 'quote',
  Seconds = 'seconds',
  None = 'none',
}

export enum FieldGroup {
  Token = 'token',
  Curve = 'curve',
  Fees = 'fees',
  Migration = 'migration',
  Liquidity = 'liquidity',
  Vesting = 'vesting',
}

export enum EditorFieldId {
  QuoteToken = 'quote-token',
  TotalSupply = 'total-supply',
  BaseDecimals = 'base-decimals',
  SupplyOnMigration = 'supply-on-migration',
  MigrationThreshold = 'migration-threshold',
  CurveShape = 'curve-shape',
  InitialMarketCap = 'initial-market-cap',
  MigrationMarketCap = 'migration-market-cap',
  WeightGrowth = 'weight-growth',
  Leftover = 'leftover',
  FeeCurve = 'fee-curve',
  StartingFee = 'starting-fee',
  EndingFee = 'ending-fee',
  FeeWindow = 'fee-window',
  CreatorTradingFeeShare = 'creator-trading-fee-share',
  DynamicFee = 'dynamic-fee',
  FirstBuyMinFee = 'first-buy-min-fee',
  FeeCollection = 'fee-collection',
  MigratedPoolFeeOption = 'migrated-pool-fee-option',
  MigratedPoolFee = 'migrated-pool-fee',
  MigratedFeeCollection = 'migrated-fee-collection',
  CompoundingShare = 'compounding-share',
  MigratedDynamicFee = 'migrated-dynamic-fee',
  MigratedFeeCurve = 'migrated-fee-curve',
  MigratedEndingFee = 'migrated-ending-fee',
  MigratedFeePeriods = 'migrated-fee-periods',
  MigratedPriceMultiple = 'migrated-price-multiple',
  MigratedFeeScheduleDuration = 'migrated-fee-schedule-duration',
  MigrationFee = 'migration-fee',
  PartnerLiquidity = 'partner-liquidity',
  PartnerLockedLiquidity = 'partner-locked-liquidity',
  CreatorLiquidity = 'creator-liquidity',
  CreatorLockedLiquidity = 'creator-locked-liquidity',
  VestedTokens = 'vested-tokens',
  VestingCliffTokens = 'vesting-cliff-tokens',
  VestingCliffDelay = 'vesting-cliff-delay',
  VestingPeriods = 'vesting-periods',
  VestingDuration = 'vesting-duration',
}

/** Whether the program adds its volatility fee on top of the base fee. */
export enum DynamicFeeChoice {
  Off = 0,
  On = 1,
}

/** Share of the graduated pool's LP fees compounded when compounding is first chosen. */
export const DEFAULT_COMPOUNDING_FEE_BPS = 5000

/** Whether the pool creator's bundled first buy pays only the minimum base fee. */
export enum FirstBuyFeeChoice {
  Schedule = 0,
  Minimum = 1,
}

/** How the trading fee moves over the launch: flat, or falling along a curve. */
export enum FeeCurve {
  Flat = 0,
  Linear = 1,
  Exponential = 2,
}

/** Program limits (DBC SDK constants), expressed in the editor's units. */
export const LIMITS = {
  minFeePercent: 0.25,
  maxFeePercent: 99,
  minMigratedPoolFeePercent: 0.1,
  maxMigratedPoolFeePercent: 10,
  maxMigrationFeePercent: 99,
  /** Token amounts never exceed the largest supply the editor accepts. */
  maxTokens: 1_000_000_000_000,
} as const

/** Applied to a customizable migrated pool when the user first picks that option. */
export const DEFAULT_CUSTOM_MIGRATED_POOL_FEE_BPS = 100

/**
 * The graduated pool's falling fee when the user first picks one: it steps down to the
 * ending fee as the price rises by `priceMultiple`, for `durationSeconds` after graduation.
 */
export const MIGRATED_FALLING_FEE_DEFAULTS = {
  endingFeeBps: 25,
  numberOfPeriod: 10,
  priceMultiple: 10,
  durationSeconds: 86_400,
} as const

/** Editor bounds of the graduated pool's falling fee (program types: u16 periods, u32 seconds). */
export const MIGRATED_FALLING_FEE_LIMITS = {
  maxPeriods: 1000,
  minPriceMultiple: 1.1,
  maxPriceMultiple: 1000,
  priceMultipleStep: 0.1,
  maxDurationSeconds: 31_536_000,
} as const

/** Why an edit was not applied. */
export enum EditRejection {
  NotANumber = 'not-a-number',
  NotAnOption = 'not-an-option',
  Hidden = 'hidden',
}

/** Order of curve shapes in the shape picker; a select option's value is its index here. */
export const CURVE_SHAPE_ORDER = [
  CurveShape.Standard,
  CurveShape.MarketCap,
  CurveShape.TwoSegments,
  CurveShape.LiquidityWeights,
] as const

export const WEIGHT_GROWTH_LIMITS = { min: 0.5, max: 2, step: 0.05 } as const

/** Opening fee and window given to a flat fee when the user switches it to a falling one. */
export const FALLING_FEE_DEFAULTS = { startingFeeBps: 5000, windowSeconds: 10 }
