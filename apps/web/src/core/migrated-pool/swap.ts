import type BN from 'bn.js'
import {
  applySwapResult,
  CollectFeeMode,
  getFeeMode,
  getSwapResultFromExactInput,
  isDynamicFeeEnabled,
  isSwapEnabled,
  TradeDirection,
} from '@meteora-ag/cp-amm-sdk'
import { trackerAfterSwap, trackerBeforeSwap } from '../volatility-tracker'
import type { MigratedPool, MigratedSwap } from './types'

/** The pool as a swap at `timestamp` sees it: the program refreshes the dynamic-fee tracker first. */
export const withTrackerBeforeSwap = (
  pool: MigratedPool,
  timestamp: BN,
): MigratedPool => {
  const dynamicFee = pool.poolFees.dynamicFee
  if (!isDynamicFeeEnabled(dynamicFee)) return pool
  return {
    ...pool,
    poolFees: {
      ...pool.poolFees,
      dynamicFee: trackerBeforeSwap(
        dynamicFee,
        dynamicFee,
        pool.sqrtPrice,
        timestamp,
      ),
    },
  }
}

/** The pool once a swap at `timestamp` moved its price: the tracker accumulates the move. */
export const withTrackerAfterSwap = (
  pool: MigratedPool,
  sqrtPriceAfter: BN,
  timestamp: BN,
): MigratedPool => {
  const dynamicFee = pool.poolFees.dynamicFee
  const moved = { ...pool, sqrtPrice: sqrtPriceAfter }
  if (!isDynamicFeeEnabled(dynamicFee)) return moved
  return {
    ...moved,
    poolFees: {
      ...pool.poolFees,
      dynamicFee: trackerAfterSwap(
        dynamicFee,
        dynamicFee,
        pool.sqrtPrice,
        sqrtPriceAfter,
        timestamp,
      ),
    },
  }
}

/**
 * Quotes a swap at `timestamp` (unix seconds — the pool activates by timestamp) on the
 * migrated pool with the DAMM v2 SDK's own swap math (`getSwapResultFromExactInput` — the
 * core of `swapQuoteExactInput` without its slippage and price-impact extras, which cost ~3×
 * the swap itself and are not used). A sell is base → quote (A → B).
 */
export const quoteMigratedSwap = (
  pool: MigratedPool,
  isSell: boolean,
  amountIn: BN,
  timestamp: BN,
): MigratedSwap => {
  if (amountIn.lten(0)) throw new Error('Amount in must be greater than 0')
  if (pool.liquidity.isZero()) throw new Error('The pool has no liquidity')
  if (!isSwapEnabled(pool, timestamp)) throw new Error('Swap is disabled')
  const before = withTrackerBeforeSwap(pool, timestamp)
  const direction = isSell ? TradeDirection.AtoB : TradeDirection.BtoA
  const feeMode = getFeeMode(before.collectFeeMode, direction, false)
  const quote = getSwapResultFromExactInput(
    before,
    amountIn,
    feeMode,
    direction,
    timestamp,
  )
  return {
    quote,
    feesOnBaseToken: feeMode.feesOnTokenA,
    feeMode,
    direction,
    pool: before,
    timestamp,
  }
}

/**
 * The pool after a swap. Concentrated liquidity only moves the price. A compounding pool
 * also moves its reserves — input in, output and the fees taken from it out — and keeps the
 * compounding share of the fee in its quote reserve; the new price comes from the SDK's
 * own `applySwapResult`, whose reserve arithmetic this mirrors. Either way the dynamic-fee
 * tracker accumulates the move.
 */
export const afterMigratedSwap = (swap: MigratedSwap): MigratedPool => {
  const { quote, feeMode, direction, pool, timestamp } = swap
  if (pool.collectFeeMode !== CollectFeeMode.Compounding)
    return withTrackerAfterSwap(pool, quote.nextSqrtPrice, timestamp)
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
    ...withTrackerAfterSwap(
      pool,
      applySwapResult(pool, quote, feeMode, direction),
      timestamp,
    ),
    tokenAAmount,
    tokenBAmount,
  }
}
