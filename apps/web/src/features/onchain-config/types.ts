import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { SolanaNetwork } from '../../core/config-deploy'
import type { LoadRejection } from './constants'

export interface OnChainConfig {
  /** The config account, even when the user pasted a pool address. */
  configAddress: string
  /** The pool address the user pasted, when they did. */
  poolAddress?: string
  network: SolanaNetwork
  parameters: ConfigParameters
}

export type LoadResult =
  | { ok: true; loaded: OnChainConfig }
  | { ok: false; rejection: LoadRejection; detail?: string }
