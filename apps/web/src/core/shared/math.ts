import type BN from 'bn.js'
import { BPS_PER_PERCENT, BPS_PRECISION, PRICE_X128_SHIFT } from './constants'

/** What `tokens` are worth in quote units at a Q64 sqrt price: tokens × (sqrtPrice / 2^64)². */
export const quoteValueAtSqrtPrice = (tokens: BN, sqrtPrice: BN): BN =>
  tokens.mul(sqrtPrice).mul(sqrtPrice).shrn(PRICE_X128_SHIFT)

/** Base units as whole tokens of `decimals` decimals, e.g. 1_500_000 at 6 → 1.5. */
export const wholeTokens = (units: BN, decimals: number): number =>
  Number(units.toString()) / 10 ** decimals

/** A fee in basis points as a percent, e.g. 250 → 2.5. */
export const percentFromBps = (bps: number): number => bps / BPS_PER_PERCENT

/**
 * A percent as basis points, exactly: float noise is removed (0.07 → 7, not 7.000000000000001)
 * but a fraction of a basis point stays a fraction, for the caller to refuse or round.
 */
export const bpsFromPercent = (percent: number): number =>
  Number((percent * BPS_PER_PERCENT).toFixed(BPS_PRECISION))
