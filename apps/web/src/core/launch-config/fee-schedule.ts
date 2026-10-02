import { BaseFeeMode } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { LaunchConfig } from './types'

export type ScheduleMode =
  BaseFeeMode.FeeSchedulerLinear | BaseFeeMode.FeeSchedulerExponential

/** A fee that falls from `startingFeeBps` to `endingFeeBps` over a window; flat when the window is 0. */
export interface FeeSchedule {
  mode: ScheduleMode
  startingFeeBps: number
  endingFeeBps: number
  windowSeconds: number
}

/** The flat fee most launchpads charge. */
export const FLAT_FEE_BPS = 100

export const FLAT_SCHEDULE: FeeSchedule = {
  mode: BaseFeeMode.FeeSchedulerLinear,
  startingFeeBps: FLAT_FEE_BPS,
  endingFeeBps: FLAT_FEE_BPS,
  windowSeconds: 0,
}

/** The config with only its fee schedule replaced; one fee period per second. */
export const withSchedule = (
  base: LaunchConfig,
  schedule: FeeSchedule,
): LaunchConfig => ({
  ...base,
  fee: {
    ...base.fee,
    baseFeeParams: {
      baseFeeMode: schedule.mode,
      feeSchedulerParam: {
        startingFeeBps: schedule.startingFeeBps,
        endingFeeBps: schedule.endingFeeBps,
        numberOfPeriod: schedule.windowSeconds,
        totalDuration: schedule.windowSeconds,
      },
    },
  },
})

/** The config's fee schedule, or null for the deprecated rate-limiter mode, which is not editable. */
export const scheduleOf = (config: LaunchConfig): FeeSchedule | null => {
  const base = config.fee.baseFeeParams
  if (base.baseFeeMode === BaseFeeMode.RateLimiter) return null
  return {
    mode: base.baseFeeMode,
    startingFeeBps: base.feeSchedulerParam.startingFeeBps,
    endingFeeBps: base.feeSchedulerParam.endingFeeBps,
    windowSeconds: base.feeSchedulerParam.totalDuration,
  }
}
