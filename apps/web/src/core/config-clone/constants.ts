import { PublicKey } from '@solana/web3.js'

/**
 * The SDK's checks need a leftover receiver other than the default key. Any will do: the
 * real one is the signer, set at deployment, where `createConfig` runs the checks again.
 */
export const STAND_IN_LEFTOVER_RECEIVER = new PublicKey(1)

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
