import { CurveShape } from '../../core/launch-config'

export enum FieldKind {
  Number = 'number',
  Select = 'select',
}

export enum FieldUnit {
  Tokens = 'tokens',
  Percent = 'percent',
  Sol = 'sol',
  Seconds = 'seconds',
  None = 'none',
}

export enum FieldGroup {
  Token = 'token',
  Curve = 'curve',
  Fees = 'fees',
  Migration = 'migration',
  Liquidity = 'liquidity',
}

export enum EditorFieldId {
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
  MigratedPoolFeeOption = 'migrated-pool-fee-option',
  MigratedPoolFee = 'migrated-pool-fee',
  MigrationFee = 'migration-fee',
  PartnerLiquidity = 'partner-liquidity',
  PartnerLockedLiquidity = 'partner-locked-liquidity',
  CreatorLiquidity = 'creator-liquidity',
  CreatorLockedLiquidity = 'creator-locked-liquidity',
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
} as const

/** Applied to a customizable migrated pool when the user first picks that option. */
export const DEFAULT_CUSTOM_MIGRATED_POOL_FEE_BPS = 100

export const BPS_PER_PERCENT = 100

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
