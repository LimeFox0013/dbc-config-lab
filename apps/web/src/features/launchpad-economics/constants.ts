/** How a launchpad's trading fee behaves over a launch. */
export enum FeeShape {
  Flat = 'flat',
  Falling = 'falling',
  RateLimiter = 'rate-limiter',
}

/** Graduation threshold bands, in SOL at the reference rate. */
export enum ThresholdBand {
  Small = 'small',
  Medium = 'medium',
  Large = 'large',
  Huge = 'huge',
}

/** Upper bounds (SOL) of each band but the last. */
export const THRESHOLD_BAND_LIMITS_SOL = {
  [ThresholdBand.Small]: 15,
  [ThresholdBand.Medium]: 60,
  [ThresholdBand.Large]: 120,
} as const

/** The creator's share of trading fees, in bands. */
export enum CreatorShareBand {
  None = 'none',
  Minority = 'minority',
  Half = 'half',
  Majority = 'majority',
  All = 'all',
}

export enum LaunchpadSort {
  PartnerIncome = 'partner-income',
  GraduationRate = 'graduation-rate',
  Launches = 'launches',
}

/** The terms launchpads can be narrowed by, in display order. */
export const ARCHETYPE_KEYS = [
  'quoteToken',
  'thresholdBand',
  'feeShape',
  'creatorShare',
] as const

/** The forecast range: the middle half of comparable launchpads' per-launch income. */
export const FORECAST_LOW_QUANTILE = 0.25
export const FORECAST_HIGH_QUANTILE = 0.75
/** Fewer comparable launchpads than this give no range. */
export const MIN_COMPARABLES = 3
