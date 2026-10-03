import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { LIQUIDITY_SHARES } from '../../core/config-clone'
import type { CloneAdjustments } from '../../core/config-clone'
import type { LiquiditySplit } from '../../core/config-deploy'
import { feeScheduleOf } from '../../core/launch-simulator'
import { bpsFromPercent, percentFromBps } from '../../core/shared'
import type { CloneForm } from './types'

const liquidityOf = (parameters: ConfigParameters): LiquiditySplit => ({
  partnerPercentage: parameters.partnerLiquidityPercentage,
  partnerLockedPercentage: parameters.partnerPermanentLockedLiquidityPercentage,
  creatorPercentage: parameters.creatorLiquidityPercentage,
  creatorLockedPercentage: parameters.creatorPermanentLockedLiquidityPercentage,
})

/** The form filled with the original's terms. */
export const formOf = (parameters: ConfigParameters): CloneForm => {
  const schedule = feeScheduleOf(parameters)
  return {
    startingFeePercent: percentFromBps(schedule?.startingFeeBps ?? 0),
    endingFeePercent: percentFromBps(schedule?.endingFeeBps ?? 0),
    windowSeconds: schedule?.windowSeconds ?? 0,
    creatorTradingFeePercentage: parameters.creatorTradingFeePercentage,
    liquidity: liquidityOf(parameters),
    firstBuyAtMinimumFee: parameters.enableFirstSwapWithMinFee,
  }
}

/**
 * Basis points exactly as entered: a fraction of a basis point stays fractional, and an
 * empty field (which arrives as a string) is not a number, so the clone refuses both
 * instead of signing a rounded or zero fee.
 */
export const bpsOf = (percent: number | string): number =>
  typeof percent === 'number' ? bpsFromPercent(percent) : Number.NaN

/**
 * Only the terms the user changed: re-deriving an untouched fee schedule from whole basis
 * points could round it, and an untouched clone must match the original exactly.
 */
export const adjustmentsOf = (
  parameters: ConfigParameters,
  form: CloneForm,
): CloneAdjustments => {
  const original = formOf(parameters)
  const feeChanged =
    form.startingFeePercent !== original.startingFeePercent ||
    form.endingFeePercent !== original.endingFeePercent ||
    form.windowSeconds !== original.windowSeconds
  const liquidityChanged = LIQUIDITY_SHARES.some(
    (key) => form.liquidity[key] !== original.liquidity[key],
  )
  return {
    ...(feeChanged && {
      feeSchedule: {
        startingFeeBps: bpsOf(form.startingFeePercent),
        endingFeeBps: bpsOf(form.endingFeePercent),
        windowSeconds: form.windowSeconds,
      },
    }),
    ...(form.creatorTradingFeePercentage !==
      original.creatorTradingFeePercentage && {
      creatorTradingFeePercentage: form.creatorTradingFeePercentage,
    }),
    ...(liquidityChanged && { liquidity: form.liquidity }),
    ...(form.firstBuyAtMinimumFee !== original.firstBuyAtMinimumFee && {
      firstBuyAtMinimumFee: form.firstBuyAtMinimumFee,
    }),
  }
}
