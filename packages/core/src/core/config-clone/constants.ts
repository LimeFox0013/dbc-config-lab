/** Why a clone's adjustments are refused before they reach the SDK. */
export const CLONE_REASONS = {
  scheduleOnly: 'Only a fee schedule can be adjusted',
  wholeNumbers:
    'Shares, fees and the fee window must be whole numbers (fees to 0.01%), with shares from 0 to 100',
} as const

/** The liquidity shares a clone may redistribute. */
export const LIQUIDITY_SHARES = [
  'partnerPercentage',
  'partnerLockedPercentage',
  'creatorPercentage',
  'creatorLockedPercentage',
] as const
