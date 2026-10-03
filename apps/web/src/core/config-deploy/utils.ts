import type { PublicKey } from '@solana/web3.js'
import { BaseFeeMode } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { SOL_DECIMALS } from '../launch-config'
import type { LaunchConfig } from '../launch-config'
import { keepersMigrate, QUOTE_TOKENS, wholeQuoteTokens } from '../quote-token'
import type { QuoteToken } from '../quote-token'
import { EXPLORER_BASE_URL, SolanaNetwork } from './constants'
import type { ConfigTerms, DeploySummary } from './types'

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

const feeSchedule = (config: LaunchConfig) => {
  const base = config.fee.baseFeeParams
  return base.baseFeeMode === BaseFeeMode.RateLimiter
    ? {
        startingFeeBps: base.rateLimiterParam.baseFeeBps,
        endingFeeBps: base.rateLimiterParam.baseFeeBps,
        feeWindowSeconds: 0,
      }
    : {
        startingFeeBps: base.feeSchedulerParam.startingFeeBps,
        endingFeeBps: base.feeSchedulerParam.endingFeeBps,
        feeWindowSeconds: base.feeSchedulerParam.totalDuration,
      }
}

const toNumber = (value: { toString: () => string }): number =>
  Number(value.toString())

/** Locked vesting in whole tokens: the cliff unlock plus every period's release. */
const lockedVestingTokens = (parameters: ConfigParameters): number => {
  const vesting = parameters.lockedVesting
  const baseUnits =
    toNumber(vesting.cliffUnlockAmount) +
    toNumber(vesting.amountPerPeriod) * toNumber(vesting.numberOfPeriod)
  return baseUnits / 10 ** parameters.tokenDecimal
}

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
  liquidity: {
    partnerPercentage: parameters.partnerLiquidityPercentage,
    partnerLockedPercentage:
      parameters.partnerPermanentLockedLiquidityPercentage,
    creatorPercentage: parameters.creatorLiquidityPercentage,
    creatorLockedPercentage:
      parameters.creatorPermanentLockedLiquidityPercentage,
  },
  lockedVestingTokens: lockedVestingTokens(parameters),
  migrationFeeOption: parameters.migrationFeeOption,
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
  config: LaunchConfig,
  parameters: ConfigParameters,
  network: SolanaNetwork,
  owner: PublicKey,
  configAddress: PublicKey,
): DeploySummary => ({
  ...configTerms(parameters, config.quoteToken),
  network,
  configAddress: configAddress.toBase58(),
  payer: owner.toBase58(),
  feeClaimer: owner.toBase58(),
  leftoverReceiver: owner.toBase58(),
  quoteMint: QUOTE_TOKENS[config.quoteToken].mints[network],
  ...feeSchedule(config),
})
