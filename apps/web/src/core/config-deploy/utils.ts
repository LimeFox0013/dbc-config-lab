import { PACKET_DATA_SIZE, PublicKey, Transaction } from '@solana/web3.js'
import BN from 'bn.js'
import { DammV2DynamicFeeMode } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { SOL_DECIMALS } from '../launch-config'
import { baseFeeBpsAt, feeScheduleOf } from '../launch-simulator'
import { keepersMigrate, QUOTE_TOKENS, wholeQuoteTokens } from '../quote-token'
import type { QuoteToken } from '../quote-token'
import {
  EXPLORER_BASE_URL,
  MAINNET_RPC_PROXY_PATH,
  PUBLIC_RPC_ENDPOINT_BY_NETWORK,
} from './constants'
import { migratedFeeBps, migratedFeeSchedule } from '../migrated-pool'
import type { RoyaltySplit } from '../preset-royalty'
import type {
  ConfigTerms,
  DeploySummary,
  TokenVesting,
  VestingSchedule,
} from './types'
import { SolanaNetwork, wholeTokens } from '../shared'

const clusterQuery = (network: SolanaNetwork): string =>
  network === SolanaNetwork.Mainnet ? '' : `?cluster=${network}`

export const explorerTransactionUrl = (
  signature: string,
  network: SolanaNetwork,
): string => `${EXPLORER_BASE_URL}/tx/${signature}${clusterQuery(network)}`

export const explorerAddressUrl = (
  address: string,
  network: SolanaNetwork,
): string => `${EXPLORER_BASE_URL}/address/${address}${clusterQuery(network)}`

/** The opening and settled fee and the window, read from the parameters being signed. */
const feeSchedule = (parameters: ConfigParameters) => {
  const schedule = feeScheduleOf(parameters)
  if (schedule)
    return {
      startingFeeBps: schedule.startingFeeBps,
      endingFeeBps: schedule.endingFeeBps,
      feeWindowSeconds: schedule.windowSeconds,
    }
  // The deprecated rate limiter starts from its cliff fee and has no time window.
  const bps = baseFeeBpsAt(parameters, 0, new BN(0))
  return { startingFeeBps: bps, endingFeeBps: bps, feeWindowSeconds: 0 }
}

const toNumber = (value: { toString: () => string }): number =>
  Number(value.toString())

/** Locked creator tokens: what unlocks at the cliff, then per period, in whole tokens. */
const lockedVesting = (parameters: ConfigParameters): TokenVesting => {
  const vesting = parameters.lockedVesting
  const tokens = (units: BN) => wholeTokens(units, parameters.tokenDecimal)
  const periods = toNumber(vesting.numberOfPeriod)
  return {
    totalTokens:
      tokens(vesting.cliffUnlockAmount) +
      tokens(vesting.amountPerPeriod) * periods,
    cliffTokens: tokens(vesting.cliffUnlockAmount),
    cliffSeconds: toNumber(vesting.cliffDurationFromMigrationTime),
    tokensPerPeriod: tokens(vesting.amountPerPeriod),
    periods,
    periodSeconds: toNumber(vesting.frequency),
  }
}

/** A vesting share of graduation liquidity, or null when the config sets none. */
const liquidityVesting = (
  info: ConfigParameters['partnerLiquidityVestingInfo'],
): VestingSchedule | null =>
  info.vestingPercentage === 0
    ? null
    : {
        percentage: info.vestingPercentage,
        cliffSeconds: info.cliffDurationFromMigrationTime,
        periods: info.numberOfPeriods,
        periodSeconds: info.frequency,
      }

/** A fixed supply in whole tokens, or null. */
const fixedSupply = (
  parameters: ConfigParameters,
): ConfigTerms['fixedSupply'] =>
  parameters.tokenSupply
    ? {
        preMigration: wholeTokens(
          parameters.tokenSupply.preMigrationTokenSupply,
          parameters.tokenDecimal,
        ),
        postMigration: wholeTokens(
          parameters.tokenSupply.postMigrationTokenSupply,
          parameters.tokenDecimal,
        ),
      }
    : null

/** A config's terms, read from the parameters that go on chain — never from an editor. */
export const configTerms = (
  parameters: ConfigParameters,
  quoteToken: QuoteToken,
): ConfigTerms => ({
  quoteToken,
  migrationThreshold: wholeQuoteTokens(
    parameters.migrationQuoteThreshold,
    quoteToken,
  ),
  keepersMigrate: keepersMigrate(
    parameters.migrationQuoteThreshold,
    quoteToken,
  ),
  dynamicFeeEnabled: parameters.poolFees.dynamicFee !== null,
  firstBuyAtMinimumFee: parameters.enableFirstSwapWithMinFee,
  tokenAuthority: parameters.tokenUpdateAuthority,
  creatorTradingFeePercentage: parameters.creatorTradingFeePercentage,
  feesCollectedIn: parameters.collectFeeMode,
  liquidity: {
    partnerPercentage: parameters.partnerLiquidityPercentage,
    partnerLockedPercentage:
      parameters.partnerPermanentLockedLiquidityPercentage,
    creatorPercentage: parameters.creatorLiquidityPercentage,
    creatorLockedPercentage:
      parameters.creatorPermanentLockedLiquidityPercentage,
  },
  partnerLiquidityVesting: liquidityVesting(
    parameters.partnerLiquidityVestingInfo,
  ),
  creatorLiquidityVesting: liquidityVesting(
    parameters.creatorLiquidityVestingInfo,
  ),
  lockedVesting: lockedVesting(parameters),
  migrationFeeOption: parameters.migrationFeeOption,
  migrationPoolFeeBps: migratedFeeBps(parameters),
  graduatedFeesCollectedIn: parameters.migratedPoolFee.collectFeeMode,
  compoundingFeeBps: parameters.compoundingFeeBps,
  graduatedDynamicFee:
    parameters.migratedPoolFee.dynamicFee === DammV2DynamicFeeMode.Enabled,
  graduatedFeeSchedule: migratedFeeSchedule(parameters),
  fixedSupply: fixedSupply(parameters),
  tokenType: parameters.tokenType,
  migrationFeePercentage: parameters.migrationFee.feePercentage,
  migrationCreatorFeePercentage: parameters.migrationFee.creatorFeePercentage,
  // The program charges the pool creation fee in SOL whatever the quote token.
  poolCreationFeeSol: toNumber(parameters.poolCreationFee) / 10 ** SOL_DECIMALS,
})

/**
 * Everything the user signs that changes who earns, who can withdraw and who controls the
 * token — read from the compiled parameters that go into the transaction.
 */
export const summarizeDeployment = (
  parameters: ConfigParameters,
  quoteToken: QuoteToken,
  network: SolanaNetwork,
  owner: PublicKey,
  configAddress: PublicKey,
  royalty: RoyaltySplit | null,
): DeploySummary => ({
  ...configTerms(parameters, quoteToken),
  network,
  configAddress: configAddress.toBase58(),
  payer: owner.toBase58(),
  feeClaimer: royalty?.vault ?? owner.toBase58(),
  leftoverReceiver: owner.toBase58(),
  quoteMint: QUOTE_TOKENS[quoteToken].mints[network],
  ...feeSchedule(parameters),
  royalty,
})

/** Whether these instructions fit one transaction under Solana's packet limit, signatures included. */
export const fitsOneTransaction = (
  transaction: Transaction,
  payer: PublicKey,
): boolean => {
  const sized = new Transaction({
    feePayer: payer,
    // Any valid hash: only the size is measured.
    recentBlockhash: PublicKey.default.toBase58(),
  }).add(...transaction.instructions)
  try {
    return (
      sized.serialize({ requireAllSignatures: false, verifySignatures: false })
        .length <= PACKET_DATA_SIZE
    )
  } catch {
    // web3.js refuses to serialize a transaction over the limit.
    return false
  }
}

/**
 * The RPC endpoint for `network`: in a page (or its workers) mainnet goes through the
 * site's own proxy; anywhere else — scripts, tests — the public endpoint is used directly.
 */
export const rpcEndpointFor = (
  network: SolanaNetwork,
  origin: string | null = typeof location === 'undefined' ? null : location.origin,
): string =>
  network === SolanaNetwork.Mainnet && origin !== null
    ? `${origin}${MAINNET_RPC_PROXY_PATH}`
    : PUBLIC_RPC_ENDPOINT_BY_NETWORK[network]

/** The websocket endpoint at the same address as an HTTP(S) one. */
export const websocketEndpointFor = (endpoint: string): string =>
  endpoint.replace(/^http/, 'ws')
