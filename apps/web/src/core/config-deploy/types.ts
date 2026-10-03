import type { PublicKey, Transaction } from '@solana/web3.js'
import type {
  MigrationFeeOption,
  TokenAuthorityOption,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { LaunchConfig } from '../launch-config'
import type { QuoteToken } from '../quote-token'
import type { SolanaNetwork } from './constants'

export interface DeployRequest {
  config: LaunchConfig
  network: SolanaNetwork
  /** The connected wallet: pays, claims fees and receives leftovers. */
  owner: PublicKey
}

/**
 * What a config decides for everyone who launches on it — who earns, who can withdraw,
 * who controls the token, what launching costs — read from its parameters.
 */
export interface ConfigTerms {
  quoteToken: QuoteToken
  /** In whole quote tokens. */
  migrationThreshold: number
  /** Meteora's migration keepers graduate this config's pools automatically. */
  keepersMigrate: boolean
  dynamicFeeEnabled: boolean
  /** The pool creator's bundled first buy pays only the minimum base fee. */
  firstBuyAtMinimumFee: boolean
  /** Who may later change the token's metadata, or mint more of it. */
  tokenAuthority: TokenAuthorityOption
  /** Share of trading fees paid to the token creator rather than the partner. */
  creatorTradingFeePercentage: number
  liquidity: LiquiditySplit
  /** Tokens locked for the creator and released after graduation. */
  lockedVestingTokens: number
  /** Fixed fee tier of the pool the launch graduates into. */
  migrationFeeOption: MigrationFeeOption
  /** Share of the graduation liquidity taken as a migration fee, and the creator's part of it. */
  migrationFeePercentage: number
  migrationCreatorFeePercentage: number
  /** Paid by whoever creates a pool on this config. */
  poolCreationFeeSol: number
}

/** What the user is about to sign, shown before the wallet prompt. */
export interface DeploySummary extends ConfigTerms {
  network: SolanaNetwork
  configAddress: string
  payer: string
  feeClaimer: string
  leftoverReceiver: string
  quoteMint: string
  startingFeeBps: number
  endingFeeBps: number
  feeWindowSeconds: number
}

/** How the graduated pool's liquidity is shared; locked shares can never be withdrawn. */
export interface LiquiditySplit {
  partnerPercentage: number
  partnerLockedPercentage: number
  creatorPercentage: number
  creatorLockedPercentage: number
}

/** A dry-run transaction waiting for the wallet's payer signature. */
export interface PreparedTransaction {
  /** Signed by one-off keys only; the wallet adds the payer signature. */
  transaction: Transaction
  /** Needed to confirm the transaction once the wallet has sent it. */
  lastValidBlockHeight: number
}

export interface PreparedDeployment extends PreparedTransaction {
  summary: DeploySummary
}

export type PrepareResult =
  { ok: true; deployment: PreparedDeployment } | { ok: false; reason: string }
