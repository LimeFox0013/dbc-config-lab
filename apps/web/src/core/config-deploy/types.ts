import type { PublicKey, Transaction } from '@solana/web3.js'
import type { LaunchConfig } from '../launch-config'
import type { SolanaNetwork } from './constants'

export interface DeployRequest {
  config: LaunchConfig
  network: SolanaNetwork
  /** The connected wallet: pays, claims fees and receives leftovers. */
  owner: PublicKey
}

/** What the user is about to sign, shown before the wallet prompt. */
export interface DeploySummary {
  network: SolanaNetwork
  configAddress: string
  payer: string
  feeClaimer: string
  leftoverReceiver: string
  quoteMint: string
  migrationThresholdSol: number
  startingFeeBps: number
  endingFeeBps: number
  feeWindowSeconds: number
}

export interface PreparedDeployment {
  /** Signed by the one-off config key only; the wallet adds the payer signature. */
  transaction: Transaction
  /** Needed to confirm the transaction once the wallet has sent it. */
  lastValidBlockHeight: number
  summary: DeploySummary
}

export type PrepareResult =
  { ok: true; deployment: PreparedDeployment } | { ok: false; reason: string }
