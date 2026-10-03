import {
  ActivationType,
  assertConfigAllowsNewPool,
  getBaseFeeParams,
  validateConfigParameters,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import {
  feeScheduleOf,
  MS_PER_SECOND,
  SLOT_DURATION_MS,
} from '../launch-simulator'
import { migratedUnsupportedReason } from '../migrated-pool'
import { errorMessage, PERCENT } from '../shared'
import {
  CLONE_REASONS,
  LIQUIDITY_SHARES,
  STAND_IN_LEFTOVER_RECEIVER,
} from './constants'
import type { FeeSchedule } from '../launch-config'
import type { CloneAdjustments, CloneResult } from './types'

/** The SDK's own checks, which mirror the DBC program's. */
const validationError = (parameters: ConfigParameters): string | null => {
  try {
    validateConfigParameters({
      ...parameters,
      leftoverReceiver: STAND_IN_LEFTOVER_RECEIVER,
    })
    return null
  } catch (error) {
    return errorMessage(error)
  }
}

/** The SDK's refusal of terms no new config may use, which no adjustment here changes. */
const retiredTermsError = (parameters: ConfigParameters): string | null => {
  try {
    assertConfigAllowsNewPool({
      baseFeeMode: parameters.poolFees.baseFee.baseFeeMode,
      migrationOption: parameters.migrationOption,
    })
    return null
  } catch (error) {
    return errorMessage(error)
  }
}

/**
 * Why this config cannot be cloned, or null when it can. Terms the program rejects today
 * but that an adjustment can fix (too little liquidity locked, say) are not a refusal:
 * `clonedParameters` reports them until the clone is adjusted.
 */
export const cloneRefusal = (parameters: ConfigParameters): string | null => {
  return retiredTermsError(parameters) ?? migratedUnsupportedReason(parameters)
}

/** One fee period per slot or per second, so the window is exact in the config's own units. */
const windowPoints = (parameters: ConfigParameters, seconds: number): number =>
  parameters.activationType === ActivationType.Slot
    ? Math.round((seconds * MS_PER_SECOND) / SLOT_DURATION_MS)
    : seconds

const isShare = (value: number | undefined): boolean =>
  value === undefined ||
  (Number.isInteger(value) && value >= 0 && value <= PERCENT)
const isCount = (value: number): boolean =>
  Number.isInteger(value) && value >= 0

/** Every adjusted number is one the program stores exactly. */
const wholeAdjustments = ({
  feeSchedule,
  creatorTradingFeePercentage,
  liquidity,
}: CloneAdjustments): boolean =>
  isShare(creatorTradingFeePercentage) &&
  (liquidity === undefined ||
    LIQUIDITY_SHARES.every((key) => isShare(liquidity[key]))) &&
  (feeSchedule === undefined ||
    (isCount(feeSchedule.startingFeeBps) &&
      isCount(feeSchedule.endingFeeBps) &&
      isCount(feeSchedule.windowSeconds)))

/** The adjusted fee schedule in the original's mode, or the SDK's reason it cannot be built. */
const scheduledBaseFee = (
  original: ConfigParameters,
  mode: FeeSchedule['mode'],
  feeSchedule: NonNullable<CloneAdjustments['feeSchedule']>,
):
  | { ok: true; baseFee: ConfigParameters['poolFees']['baseFee'] }
  | { ok: false; reason: string } => {
  const points = windowPoints(original, feeSchedule.windowSeconds)
  try {
    return {
      ok: true,
      baseFee: getBaseFeeParams({
        baseFeeMode: mode,
        feeSchedulerParam: {
          startingFeeBps: feeSchedule.startingFeeBps,
          endingFeeBps: feeSchedule.endingFeeBps,
          numberOfPeriod: points,
          totalDuration: points,
        },
      }),
    }
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  }
}

/**
 * The original's parameters with the adjustments applied, checked by the SDK's validation.
 * Who receives fees and leftovers is not a parameter: deployment sets it to the signer.
 */
export const clonedParameters = (
  original: ConfigParameters,
  adjustments: CloneAdjustments,
): CloneResult => {
  const refusal = cloneRefusal(original)
  if (refusal) return { ok: false, reason: refusal }
  const schedule = feeScheduleOf(original)
  if (adjustments.feeSchedule && !schedule)
    return { ok: false, reason: CLONE_REASONS.scheduleOnly }
  // What is shown is what is signed: the program stores integers and would drop fractions.
  if (!wholeAdjustments(adjustments))
    return { ok: false, reason: CLONE_REASONS.wholeNumbers }

  const {
    feeSchedule,
    creatorTradingFeePercentage,
    liquidity,
    firstBuyAtMinimumFee,
  } = adjustments
  const baseFee =
    feeSchedule && schedule
      ? scheduledBaseFee(original, schedule.mode, feeSchedule)
      : { ok: true as const, baseFee: original.poolFees.baseFee }
  if (!baseFee.ok) return baseFee
  const parameters: ConfigParameters = {
    ...original,
    poolFees: { ...original.poolFees, baseFee: baseFee.baseFee },
    creatorTradingFeePercentage:
      creatorTradingFeePercentage ?? original.creatorTradingFeePercentage,
    partnerLiquidityPercentage:
      liquidity?.partnerPercentage ?? original.partnerLiquidityPercentage,
    partnerPermanentLockedLiquidityPercentage:
      liquidity?.partnerLockedPercentage ??
      original.partnerPermanentLockedLiquidityPercentage,
    creatorLiquidityPercentage:
      liquidity?.creatorPercentage ?? original.creatorLiquidityPercentage,
    creatorPermanentLockedLiquidityPercentage:
      liquidity?.creatorLockedPercentage ??
      original.creatorPermanentLockedLiquidityPercentage,
    enableFirstSwapWithMinFee:
      firstBuyAtMinimumFee ?? original.enableFirstSwapWithMinFee,
  }
  const invalid = validationError(parameters)
  return invalid ? { ok: false, reason: invalid } : { ok: true, parameters }
}
