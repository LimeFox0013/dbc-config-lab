import { validateConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { buildConfigParameters } from './curve'
import { VALIDATION_LEFTOVER_RECEIVER } from './constants'
import type { CompiledLaunchConfig, LaunchConfig } from './types'
import { errorMessage } from '../shared'

/** The SDK's reason to refuse these parameters (its checks mirror the DBC program's), or null. */
export const parametersRejection = (
  parameters: ConfigParameters,
): string | null => {
  try {
    validateConfigParameters({
      ...parameters,
      leftoverReceiver: VALIDATION_LEFTOVER_RECEIVER,
    })
    return null
  } catch (error) {
    return errorMessage(error)
  }
}

/**
 * Turns a launch config into the on-chain config parameters, rejecting any combination
 * the DBC program would refuse.
 */
export const compileLaunchConfig = (
  config: LaunchConfig,
): CompiledLaunchConfig => {
  try {
    const parameters = buildConfigParameters(config)
    const rejection = parametersRejection(parameters)
    return rejection
      ? { ok: false, reason: rejection }
      : { ok: true, parameters, quoteToken: config.quoteToken }
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  }
}

export const serializeLaunchConfig = (config: LaunchConfig): string =>
  JSON.stringify(config)

export const parseLaunchConfig = (document: string): LaunchConfig =>
  JSON.parse(document)
