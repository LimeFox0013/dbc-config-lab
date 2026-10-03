import BN from 'bn.js'
import {
  getFeeMode,
  getSwapResultFromExactInput,
  isSwapEnabled,
  TradeDirection,
} from '@meteora-ag/cp-amm-sdk'
import type { SwapResult2 } from '@meteora-ag/cp-amm-sdk'
import type { MigratedPool } from './types'

export type { MigratedPool, PulledLiquidity } from './types'
export {
  lockedLiquidity,
  migratedFeeBps,
  migratedUnsupportedReason,
  pullableLiquidityPercent,
  toMigratedPool,
  withUnlockedLiquidityPulled,
} from './utils'

export interface MigratedSwap {
  quote: SwapResult2
  /** Whether the fee was taken from the base token (A) rather than the quote token (B). */
  feesOnBaseToken: boolean
}

/**
 * Quotes a swap on the migrated pool with the DAMM v2 SDK's own swap math
 * (`getSwapResultFromExactInput` — the core of `swapQuoteExactInput` without its slippage
 * and price-impact extras, which cost ~3× the swap itself and are not used). A sell is
 * base → quote (A → B). For concentrated liquidity the only state change is the new price.
 */
export const quoteMigratedSwap = (
  pool: MigratedPool,
  isSell: boolean,
  amountIn: BN,
  at: number,
): MigratedSwap => {
  if (amountIn.lten(0)) throw new Error('Amount in must be greater than 0')
  if (pool.liquidity.isZero()) throw new Error('The pool has no liquidity')
  const currentPoint = new BN(at)
  if (!isSwapEnabled(pool, currentPoint)) throw new Error('Swap is disabled')
  const direction = isSell ? TradeDirection.AtoB : TradeDirection.BtoA
  const feeMode = getFeeMode(pool.collectFeeMode, direction, false)
  const quote = getSwapResultFromExactInput(
    pool,
    amountIn,
    feeMode,
    direction,
    currentPoint,
  )
  return { quote, feesOnBaseToken: feeMode.feesOnTokenA }
}

export const afterMigratedSwap = (
  pool: MigratedPool,
  swap: MigratedSwap,
): MigratedPool => ({
  ...pool,
  sqrtPrice: swap.quote.nextSqrtPrice,
})
