import { validateConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { buildConfigParameters } from './curve'
import { VALIDATION_LEFTOVER_RECEIVER } from './constants'
import type { CompiledLaunchConfig, LaunchConfig } from './types'
import { errorMessage } from '../shared'

export type {
  CompiledLaunchConfig,
  CurveSpec,
  LaunchConfig,
  LaunchPreset,
} from './types'
export {
  curveOf,
  DEFAULT_MARKET_CAPS,
  DEFAULT_WEIGHT_GROWTH,
  defaultCurve,
  geometricWeights,
  LIQUIDITY_WEIGHT_SEGMENTS,
  MIN_SHAPED_CURVE_LEFTOVER,
  weightGrowthOf,
  withCurve,
} from './curve'
export { LAUNCH_PRESETS } from './presets'
export {
  FLAT_FEE_BPS,
  FLAT_SCHEDULE,
  scheduleOf,
  withSchedule,
} from './fee-schedule'
export type { FeeSchedule, ScheduleMode } from './fee-schedule'
export { CurveShape, DEFAULT_LAUNCH_CONFIG, SOL_DECIMALS } from './constants'

/**
 * Turns a launch config into the on-chain config parameters, rejecting any combination
 * the DBC program would refuse.
 */
export const compileLaunchConfig = (
  config: LaunchConfig,
): CompiledLaunchConfig => {
  try {
    const parameters = buildConfigParameters(config)
    validateConfigParameters({
      ...parameters,
      leftoverReceiver: VALIDATION_LEFTOVER_RECEIVER,
    })
    return { ok: true, parameters }
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  }
}

export const serializeLaunchConfig = (config: LaunchConfig): string =>
  JSON.stringify(config)

export const parseLaunchConfig = (document: string): LaunchConfig =>
  JSON.parse(document)
