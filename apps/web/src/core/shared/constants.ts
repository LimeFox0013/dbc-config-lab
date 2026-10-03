export enum SolanaNetwork {
  Devnet = 'devnet',
  Mainnet = 'mainnet-beta',
}

/** Basis points in a whole. */
export const BPS_SCALE = 10_000

/** sqrtPrice is Q64, so a price compared with sqrtPrice² carries this many fractional bits. */
export const PRICE_X128_SHIFT = 128

/** Shares are whole percentages of this. */
export const PERCENT = 100

/** Fees are shown in percent; configs store basis points. */
export const BPS_PER_PERCENT = 100

/** Fractional digits kept when converting a percent to basis points, enough to absorb float noise. */
export const BPS_PRECISION = 6

/** Characters kept at each end of an address when it is shortened for display. */
export const ADDRESS_EDGE = 4
