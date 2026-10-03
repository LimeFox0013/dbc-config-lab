import type BN from 'bn.js'
import type { PublicKey } from '@solana/web3.js'
import type { PreparedTransaction } from '../config-deploy'
import type { FeeRole } from './constants'
import type { SolanaNetwork } from '../shared'

export interface ClaimRequest {
  pool: PublicKey
  role: FeeRole
  network: SolanaNetwork
  /** The connected wallet: the fee claimer or creator, payer and receiver. */
  owner: PublicKey
  /** The unclaimed amounts, in base units; the claim takes at most these. */
  maxQuoteAmount: BN
  maxBaseAmount: BN
  /** For the vault roles: the royalty vault, and the config whose fees it collects. */
  vault: PublicKey | null
  config: PublicKey | null
}

export interface ClaimSummary {
  network: SolanaNetwork
  pool: string
  role: FeeRole
  receiver: string
  quoteAmount: string
  baseAmount: string
}

export interface PreparedClaim extends PreparedTransaction {
  summary: ClaimSummary
}

export type PrepareClaimResult =
  { ok: true; claim: PreparedClaim } | { ok: false; reason: string }
