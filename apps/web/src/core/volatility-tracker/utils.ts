import BN from 'bn.js'
import { MAX_BASIS_POINT, ONE_Q64 } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { Q64_SHIFT } from './constants'
import type { TrackerSettings, TrackerState } from './types'

/*
 * The volatility tracker the DBC program (state/fee.rs, VolatilityTracker; virtual_pool.rs,
 * update_pre_swap / update_post_swap) and the DAMM v2 program (state/fee.rs,
 * DynamicFeeStruct; pool.rs, update_pre_swap / update_post_swap) both run, ported so the
 * dynamic fee can be replayed: the SDKs quote from the stored tracker but do not advance
 * it between swaps.
 */

/** Bins crossed between two sqrt prices, as the programs count them (times two, rounded down). */
export const deltaBinId = (
  binStepU128: BN,
  sqrtPriceA: BN,
  sqrtPriceB: BN,
): BN => {
  const [upper, lower] = sqrtPriceA.gt(sqrtPriceB)
    ? [sqrtPriceA, sqrtPriceB]
    : [sqrtPriceB, sqrtPriceA]
  return upper.shln(Q64_SHIFT).div(lower).sub(ONE_Q64).div(binStepU128).muln(2)
}

/** Before a swap: refreshes the price reference and decays the volatility once trading pauses. */
export const trackerBeforeSwap = <T extends TrackerState>(
  tracker: T,
  settings: TrackerSettings,
  sqrtPrice: BN,
  timestamp: BN,
): T => {
  const elapsed = BN.max(timestamp.sub(tracker.lastUpdateTimestamp), new BN(0))
  if (elapsed.ltn(settings.filterPeriod)) return tracker
  return {
    ...tracker,
    sqrtPriceReference: sqrtPrice,
    volatilityReference: elapsed.ltn(settings.decayPeriod)
      ? tracker.volatilityAccumulator
          .muln(settings.reductionFactor)
          .divn(MAX_BASIS_POINT)
      : new BN(0),
  }
}

/** After a swap: accumulates the move from the reference price, stamped only if a bin was crossed. */
export const trackerAfterSwap = <T extends TrackerState>(
  tracker: T,
  settings: TrackerSettings,
  sqrtPriceBefore: BN,
  sqrtPriceAfter: BN,
  timestamp: BN,
): T => {
  const accumulated = tracker.volatilityReference.add(
    deltaBinId(
      settings.binStepU128,
      sqrtPriceAfter,
      tracker.sqrtPriceReference,
    ).muln(MAX_BASIS_POINT),
  )
  return {
    ...tracker,
    volatilityAccumulator: BN.min(
      accumulated,
      new BN(settings.maxVolatilityAccumulator),
    ),
    lastUpdateTimestamp: deltaBinId(
      settings.binStepU128,
      sqrtPriceBefore,
      sqrtPriceAfter,
    ).isZero()
      ? tracker.lastUpdateTimestamp
      : timestamp,
  }
}
