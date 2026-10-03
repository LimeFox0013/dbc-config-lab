import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { SolanaNetwork } from '../../core/config-deploy'
import type { QuoteToken } from '../../core/quote-token'
import type { LoadRejection } from './constants'

export interface OnChainConfig {
  /** The config account, even when the user pasted a pool address. */
  configAddress: string
  /** The pool address the user pasted, when they did. */
  poolAddress?: string
  network: SolanaNetwork
  parameters: ConfigParameters
  /** Read from the config's quote mint; amounts are simulated in this token. */
  quoteToken: QuoteToken
}

/** A config as read from chain, in raw units, with the mint it is priced in. */
export type ReadOnChainConfig = Omit<OnChainConfig, 'quoteToken'> & {
  quoteMint: string
}

type Refusal = { ok: false; rejection: LoadRejection; detail?: string }

export type ReadResult = { ok: true; read: ReadOnChainConfig } | Refusal

export type LoadResult = { ok: true; loaded: OnChainConfig } | Refusal
