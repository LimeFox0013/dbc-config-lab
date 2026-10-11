import type BN from 'bn.js'
import type {
  FeeMode,
  PoolState,
  SwapResult2,
  TradeDirection,
} from '@meteora-ag/cp-amm-sdk'

/** The DAMM v2 pool a graduated launch trades on, held in memory. */
export type MigratedPool = PoolState

/** What withdrawing liquidity returns, and its worth in quote at the pool's price then. */
export interface PulledLiquidity {
  base: BN
  quote: BN
  /** Quote lamports: the quote plus the base valued at the pool's price at the time. */
  value: BN
}

export interface MigratedSwap {
  quote: SwapResult2
  /** Whether the fee was taken from the base token (A) rather than the quote token (B). */
  feesOnBaseToken: boolean
  feeMode: FeeMode
  direction: TradeDirection
  /** The pool as the swap saw it, its dynamic-fee tracker refreshed. */
  pool: PoolState
  /** When the swap ran, in unix seconds. */
  timestamp: BN
}

/** A graduated pool fee that falls as the price rises above the graduation price. */
export interface MigratedFeeSchedule {
  exponential: boolean
  /** The fee once the price has risen by `priceMultiple`, in whole bps. */
  endingFeeBps: number
  steps: number
  priceMultiple: number
  /** After this long from graduation the pool charges the ending fee whatever the price. */
  durationSeconds: number
}

/** The graduated pool's packed base-fee record and the lowest fee it can charge. */
export interface MigratedBaseFee {
  data: number[]
  minFeeNumerator: BN
}
