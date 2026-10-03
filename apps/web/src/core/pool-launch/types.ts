import type { PublicKey } from '@solana/web3.js'
import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { ConfigTerms, PreparedTransaction } from '../config-deploy'
import type { QuoteToken } from '../quote-token'
import type { SolanaNetwork } from '../shared'

export interface TokenMetadata {
  name: string
  symbol: string
  /** Link to the token's metadata JSON (image, description); may be empty. */
  uri: string
}

export interface LaunchRequest {
  /** An existing config on `network`. */
  configAddress: PublicKey
  parameters: ConfigParameters
  quoteToken: QuoteToken
  network: SolanaNetwork
  /** The connected wallet: pays, becomes the pool creator, receives the first buy. */
  owner: PublicKey
  metadata: TokenMetadata
  /** Whole quote tokens the creator buys in the same transaction; 0 for none. */
  firstBuy: number
}

/** What the user is about to sign, shown before the wallet prompt. */
export interface LaunchSummary {
  network: SolanaNetwork
  configAddress: string
  poolAddress: string
  mintAddress: string
  creator: string
  metadata: TokenMetadata
  quoteToken: QuoteToken
  /** What the config decides for the creator — costs, fee shares, authority. */
  terms: ConfigTerms
  firstBuy: {
    /** Whole quote tokens, fee included. */
    amount: number
    /** Whole tokens the simulator expects it to receive. */
    expectedTokens: number
    /** Whole tokens below which the program fails the buy. */
    minimumTokens: number
    baseFeeBps: number
    atMinimumFee: boolean
  } | null
}

export interface PreparedLaunch extends PreparedTransaction {
  summary: LaunchSummary
}

export type PrepareLaunchResult =
  { ok: true; launch: PreparedLaunch } | { ok: false; reason: string }
