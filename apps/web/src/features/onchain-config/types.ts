import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { QuoteToken } from '../../core/quote-token'
import type { LoadRejection } from './constants'
import type { SolanaNetwork } from '../../core/shared'

export interface OnChainConfig {
  /** The config account, even when the user pasted a pool address. */
  configAddress: string
  /** The pool address the user pasted, when they did. */
  poolAddress?: string
  network: SolanaNetwork
  /** The launchpad operator's wallet: receives its partner fees and owns its branding. */
  feeClaimer: string
  parameters: ConfigParameters
  /** Read from the config's quote mint; amounts are simulated in this token. */
  quoteToken: QuoteToken
}

/** A config as read from chain, in raw units, with the mint it is priced in. */
export type ReadOnChainConfig = Omit<OnChainConfig, 'quoteToken'> & {
  quoteMint: string
}

/** Why a config could not be read or priced, as a code the screen words. */
export interface LoadRefusal {
  rejection: LoadRejection
  detail?: string
}

type Refusal = { ok: false } & LoadRefusal

export type ReadResult = { ok: true; read: ReadOnChainConfig } | Refusal

export type LoadResult = { ok: true; loaded: OnChainConfig } | Refusal
