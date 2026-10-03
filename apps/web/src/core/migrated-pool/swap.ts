import BN from 'bn.js'
import {
  applySwapResult,
  CollectFeeMode,
  getFeeMode,
  getSwapResultFromExactInput,
  isSwapEnabled,
  TradeDirection,
} from '@meteora-ag/cp-amm-sdk'
import type { MigratedPool, MigratedSwap } from './types'

/**
 * Quotes a swap on the migrated pool with the DAMM v2 SDK's own swap math
 * (`getSwapResultFromExactInput` — the core of `swapQuoteExactInput` without its slippage
 * and price-impact extras, which cost ~3× the swap itself and are not used). A sell is
 * base → quote (A → B).
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
  return { quote, feesOnBaseToken: feeMode.feesOnTokenA, feeMode, direction }
}

/**
 * The pool after a swap. Concentrated liquidity only moves the price. A compounding pool
 * also moves its reserves — input in, output and the fees taken from it out — and keeps the
 * compounding share of the fee in its quote reserve; the new price comes from the SDK's
 * own `applySwapResult`, whose reserve arithmetic this mirrors.
 */
export const afterMigratedSwap = (
  pool: MigratedPool,
  swap: MigratedSwap,
): MigratedPool => {
  if (pool.collectFeeMode !== CollectFeeMode.Compounding)
    return { ...pool, sqrtPrice: swap.quote.nextSqrtPrice }
  const { quote, feeMode, direction } = swap
  const fees = quote.claimingFee
    .add(quote.compoundingFee)
    .add(quote.protocolFee)
    .add(quote.referralFee)
  const paidOut = feeMode.feesOnInput
    ? quote.outputAmount
    : quote.outputAmount.add(fees)
  const sellsBase = direction === TradeDirection.AtoB
  const tokenAAmount = sellsBase
    ? pool.tokenAAmount.add(quote.excludedFeeInputAmount)
    : pool.tokenAAmount.sub(paidOut)
  const tokenBAmount = (
    sellsBase
      ? pool.tokenBAmount.sub(paidOut)
      : pool.tokenBAmount.add(quote.excludedFeeInputAmount)
  ).add(quote.compoundingFee)
  return {
    ...pool,
    tokenAAmount,
    tokenBAmount,
    sqrtPrice: applySwapResult(pool, quote, feeMode, direction),
  }
}
