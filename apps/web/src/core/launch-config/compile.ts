import { validateConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { buildConfigParameters } from './curve'
import { VALIDATION_LEFTOVER_RECEIVER } from './constants'
import type { CompiledLaunchConfig, LaunchConfig } from './types'
import { errorMessage } from '../shared'

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
    return { ok: true, parameters, quoteToken: config.quoteToken }
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  }
}

export const serializeLaunchConfig = (config: LaunchConfig): string =>
  JSON.stringify(config)

export const parseLaunchConfig = (document: string): LaunchConfig =>
  JSON.parse(document)
