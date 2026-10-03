import type { PublicKey, Transaction } from '@solana/web3.js'
import type {
  CollectFeeMode,
  ConfigParameters,
  MigratedCollectFeeMode,
  MigrationFeeOption,
  TokenAuthorityOption,
  TokenType,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { LaunchConfig } from '../launch-config'
import type { QuoteToken } from '../quote-token'
import type { SolanaNetwork } from '../shared'

export interface DeployRequest {
  config: LaunchConfig
  network: SolanaNetwork
  /** The connected wallet: pays, claims fees and receives leftovers. */
  owner: PublicKey
}

/** Deploying already-compiled parameters — a built config or a clone of one on chain. */
export interface ParametersDeployRequest {
  parameters: ConfigParameters
  quoteToken: QuoteToken
  network: SolanaNetwork
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
  /** Fees on the bonding curve are taken in the quote token, or in whichever token a trade receives. */
  feesCollectedIn: CollectFeeMode
  liquidity: LiquiditySplit
  /** Graduation liquidity that unlocks over time, for the partner and for the creator; null when none. */
  partnerLiquidityVesting: VestingSchedule | null
  creatorLiquidityVesting: VestingSchedule | null
  /** Tokens locked for the creator and released after graduation, and when. */
  lockedVesting: TokenVesting
  /** Fee tier option of the pool the launch graduates into, and the fee it sets. */
  migrationFeeOption: MigrationFeeOption
  /** Null for an option the tool does not know. */
  migrationPoolFeeBps: number | null
  /** How the graduated pool collects fees, and the share of LP fees it compounds into its reserves. */
  graduatedFeesCollectedIn: MigratedCollectFeeMode
  compoundingFeeBps: number
  /** A fixed token supply, before and after graduation, in whole tokens; null when not fixed. */
  fixedSupply: { preMigration: number; postMigration: number } | null
  tokenType: TokenType
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

/** A share of graduation liquidity that unlocks after a cliff, then in equal periods. */
export interface VestingSchedule {
  percentage: number
  cliffSeconds: number
  periods: number
  periodSeconds: number
}

/** Creator tokens locked at graduation: some at the cliff, then a fixed amount per period. */
export interface TokenVesting {
  totalTokens: number
  cliffTokens: number
  cliffSeconds: number
  tokensPerPeriod: number
  periods: number
  periodSeconds: number
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
