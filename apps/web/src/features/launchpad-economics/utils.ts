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
import { isRecord, PERCENT, SolanaNetwork } from '../../core/shared'
import { DbcAccount } from '../onchain-config'
import { percentile } from '../real-launches'
import {
  AfterGraduationBasis,
  ARCHETYPE_KEYS,
  CreatorShareBand,
  FORECAST_HIGH_QUANTILE,
  FORECAST_LOW_QUANTILE,
  MIN_COMPARABLES,
  RELAXABLE_TERMS,
  FeeShape,
  LaunchpadSort,
  THRESHOLD_BAND_LIMITS_SOL,
  ThresholdBand,
} from './constants'
import type {
  AfterGraduation,
  Archetype,
  IncomeForecast,
  LaunchpadFilter,
  LaunchpadQuery,
  LaunchpadRecord,
  LaunchpadSnapshot,
  RelaxableTerm,
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
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/** A snapshot's after-graduation entry, or null when it is missing or not one this build reads. */
export const readAfterGraduation = (raw: unknown): AfterGraduation | null => {
  if (!isRecord(raw)) return null
  switch (raw['basis']) {
    case AfterGraduationBasis.NoShare:
      return { basis: AfterGraduationBasis.NoShare }
    case AfterGraduationBasis.NotHeld:
      return { basis: AfterGraduationBasis.NotHeld }
    case AfterGraduationBasis.Positions: {
      const { sampledPositions, median, p75 } = raw
      return isNumber(sampledPositions) && isNumber(median) && isNumber(p75)
        ? {
            basis: AfterGraduationBasis.Positions,
            sampledPositions,
            median,
            p75,
          }
        : null
    }
    default:
      return null
  }
}

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
        afterGraduation: readAfterGraduation(launchpad.afterGraduation),
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

/** The filter for these terms with `relaxed` ones set aside. */
const filterWithout = (
  archetype: Archetype,
  relaxed: readonly RelaxableTerm[],
): LaunchpadFilter => {
  const kept = <K extends RelaxableTerm>(key: K): Archetype[K] | undefined =>
    relaxed.includes(key) ? undefined : archetype[key]
  return {
    quoteToken: archetype.quoteToken,
    thresholdBand: kept('thresholdBand'),
    feeShape: kept('feeShape'),
    creatorShare: kept('creatorShare'),
  }
}

/**
 * What a launchpad with these terms could earn from `launches` launches: the middle half
 * of what real launchpads with the same terms earned per launch. When too few share every
 * term, terms are set aside in `RELAXABLE_TERMS` order until enough do; no range when
 * even that leaves too few.
 */
export const incomeForecast = (
  records: readonly LaunchpadRecord[],
  archetype: Archetype,
  launches: number,
): IncomeForecast => {
  const steps = RELAXABLE_TERMS.map((_, i) =>
    RELAXABLE_TERMS.slice(0, i),
  ).concat([[...RELAXABLE_TERMS]])
  const found = steps
    .map((relaxed) => ({
      relaxed,
      comparables: records.filter((record) =>
        matches(record, filterWithout(archetype, relaxed)),
      ),
    }))
    .find(({ comparables }) => comparables.length >= MIN_COMPARABLES)
  if (!found)
    return {
      ok: false,
      comparables: records.filter((record) => matches(record, archetype))
        .length,
      minimum: MIN_COMPARABLES,
    }
  const { comparables, relaxed } = found
  const perLaunch = comparables.map((record) => record.partnerIncomeMedian)
  const afterPerLaunch = comparables.flatMap((record) => {
    const after = afterGraduationPerLaunch(record)
    return after === null ? [] : [after]
  })
  return {
    ok: true,
    low: percentile(perLaunch, FORECAST_LOW_QUANTILE) * launches,
    high: percentile(perLaunch, FORECAST_HIGH_QUANTILE) * launches,
    launchpads: comparables.length,
    launches: comparables.reduce((sum, record) => sum + record.launches, 0),
    takenAt: comparables[0]?.takenAt ?? '',
    afterGraduation:
      afterPerLaunch.length === 0
        ? null
        : {
            low: percentile(afterPerLaunch, FORECAST_LOW_QUANTILE) * launches,
            high: percentile(afterPerLaunch, FORECAST_HIGH_QUANTILE) * launches,
            launchpads: afterPerLaunch.length,
          },
    relaxed,
  }
}

/**
 * Median income after graduation per launch, in SOL: each held position earns for one
 * graduated launch, so its median is scaled by the share of launches that graduate; zero for
 * a launchpad that keeps no graduation liquidity, null when it cannot be measured.
 */
export const afterGraduationPerLaunch = (
  record: LaunchpadRecord,
): number | null => {
  const after = record.afterGraduation
  if (!after) return null
  switch (after.basis) {
    case AfterGraduationBasis.NoShare:
      return 0
    case AfterGraduationBasis.Positions:
      return after.median * graduationRate(record)
    case AfterGraduationBasis.NotHeld:
      return null
  }
}
