import {
  BaseFeeMode,
  createDbcProgram,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type {
  ConfigParameters,
  PoolConfig,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { connectionFor } from '../../core/config-deploy'
import { fromPoolConfig } from '../../core/onchain-config'
import {
  QUOTE_TOKENS,
  quoteTokenOfMint,
  wholeQuoteTokens,
} from '../../core/quote-token'
import type { QuoteToken } from '../../core/quote-token'
import { PERCENT, SolanaNetwork } from '../../core/shared'
import { DbcAccount } from '../onchain-config'
import { percentile } from '../real-launches'
import {
  ARCHETYPE_KEYS,
  CreatorShareBand,
  FORECAST_HIGH_QUANTILE,
  FORECAST_LOW_QUANTILE,
  MIN_COMPARABLES,
  FeeShape,
  LaunchpadSort,
  THRESHOLD_BAND_LIMITS_SOL,
  ThresholdBand,
} from './constants'
import type {
  Archetype,
  IncomeForecast,
  LaunchpadFilter,
  LaunchpadQuery,
  LaunchpadRecord,
  LaunchpadSnapshot,
} from './types'

const feeShapeOf = (parameters: ConfigParameters): FeeShape => {
  const { baseFeeMode, firstFactor, thirdFactor } = parameters.poolFees.baseFee
  if (baseFeeMode === BaseFeeMode.RateLimiter) return FeeShape.RateLimiter
  // A scheduler with no periods or no reduction charges the same fee throughout.
  return firstFactor === 0 || thirdFactor.isZero()
    ? FeeShape.Flat
    : FeeShape.Falling
}

const thresholdBandOf = (sol: number): ThresholdBand =>
  sol < THRESHOLD_BAND_LIMITS_SOL[ThresholdBand.Small]
    ? ThresholdBand.Small
    : sol < THRESHOLD_BAND_LIMITS_SOL[ThresholdBand.Medium]
      ? ThresholdBand.Medium
      : sol < THRESHOLD_BAND_LIMITS_SOL[ThresholdBand.Large]
        ? ThresholdBand.Large
        : ThresholdBand.Huge

const creatorShareOf = (percent: number): CreatorShareBand =>
  percent === 0
    ? CreatorShareBand.None
    : percent < 50
      ? CreatorShareBand.Minority
      : percent === 50
        ? CreatorShareBand.Half
        : percent < PERCENT
          ? CreatorShareBand.Majority
          : CreatorShareBand.All

/** The terms a launchpad is grouped by, read from its config. */
export const archetypeOf = (
  parameters: ConfigParameters,
  quoteToken: QuoteToken,
): Archetype => ({
  quoteToken,
  thresholdBand: thresholdBandOf(
    wholeQuoteTokens(parameters.migrationQuoteThreshold, quoteToken) *
      QUOTE_TOKENS[quoteToken].solPerToken,
  ),
  feeShape: feeShapeOf(parameters),
  creatorShare: creatorShareOf(parameters.creatorTradingFeePercentage),
})

/**
 * The snapshot's launchpads, decoded offline (the program client only lends its account
 * coder). The fee claimer's income is the partner share of each launch's curve fees.
 */
export const launchpadRecords = (
  snapshot: LaunchpadSnapshot,
): LaunchpadRecord[] => {
  const { program } = createDbcProgram(connectionFor(SolanaNetwork.Mainnet))
  return snapshot.launchpads.flatMap((launchpad) => {
    const config: PoolConfig = program.coder.accounts.decode(
      DbcAccount.PoolConfig,
      Buffer.from(launchpad.configBase64, 'base64'),
    )
    const quoteToken = quoteTokenOfMint(
      config.quoteMint.toBase58(),
      SolanaNetwork.Mainnet,
    )
    if (!quoteToken) return []
    const parameters = fromPoolConfig(config)
    const partnerShare =
      (PERCENT - parameters.creatorTradingFeePercentage) / PERCENT
    return [
      {
        config: {
          configAddress: launchpad.configAddress,
          network: SolanaNetwork.Mainnet,
          feeClaimer: config.feeClaimer.toBase58(),
          parameters,
          quoteToken,
        },
        archetype: archetypeOf(parameters, quoteToken),
        launches: launchpad.launches,
        graduated: launchpad.graduated,
        sampledPools: launchpad.sampledPools,
        neverTradedShare: launchpad.neverTradedShare,
        medianSecondsToComplete: launchpad.medianSecondsToComplete,
        partnerIncomeMedian: launchpad.medianCurveFees * partnerShare,
        partnerIncomeP75: launchpad.p75CurveFees * partnerShare,
        takenAt: snapshot.takenAt,
      },
    ]
  })
}

export const graduationRate = (record: LaunchpadRecord): number =>
  record.launches === 0 ? 0 : record.graduated / record.launches

const matches = (record: LaunchpadRecord, filter: LaunchpadFilter): boolean =>
  ARCHETYPE_KEYS.every(
    (key) => filter[key] === undefined || record.archetype[key] === filter[key],
  )

const SORT_KEY: Record<LaunchpadSort, (record: LaunchpadRecord) => number> = {
  [LaunchpadSort.PartnerIncome]: (r) => r.partnerIncomeMedian,
  [LaunchpadSort.GraduationRate]: graduationRate,
  [LaunchpadSort.Launches]: (r) => r.launches,
}

/** Launchpads matching every set filter, best first by the chosen measure. */
export const rankLaunchpads = (
  records: readonly LaunchpadRecord[],
  query: LaunchpadQuery,
): LaunchpadRecord[] =>
  records
    .filter((record) => matches(record, query.filter))
    .sort((a, b) => SORT_KEY[query.sort](b) - SORT_KEY[query.sort](a))

/**
 * What a launchpad with these terms could earn from `launches` launches: the middle half
 * of what real launchpads with the same terms earned per launch. No range from too few.
 */
export const incomeForecast = (
  records: readonly LaunchpadRecord[],
  archetype: Archetype,
  launches: number,
): IncomeForecast => {
  const comparables = records.filter((record) => matches(record, archetype))
  if (comparables.length < MIN_COMPARABLES)
    return {
      ok: false,
      comparables: comparables.length,
      minimum: MIN_COMPARABLES,
    }
  const perLaunch = comparables.map((record) => record.partnerIncomeMedian)
  return {
    ok: true,
    low: percentile(perLaunch, FORECAST_LOW_QUANTILE) * launches,
    high: percentile(perLaunch, FORECAST_HIGH_QUANTILE) * launches,
    launchpads: comparables.length,
    launches: comparables.reduce((sum, record) => sum + record.launches, 0),
    takenAt: comparables[0]?.takenAt ?? '',
  }
}
