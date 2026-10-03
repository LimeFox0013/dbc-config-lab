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
}
