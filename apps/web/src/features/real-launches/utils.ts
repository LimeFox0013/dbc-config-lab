import BN from 'bn.js'
import {
  ActivationType,
  getBaseTokenForSwap,
  getMigrationThresholdPrice,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type {
  ConfigParameters,
  VirtualPool,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { solFromQuoteUnits } from '../../core/quote-token'
import type { QuoteToken } from '../../core/quote-token'
import { P75, TRACTION_SHARE } from './constants'
import type { PoolRecord, RealLaunches } from './types'

/** Up to `limit` items spread evenly over `items`, first one included; all of them if fewer. */
export const evenSample = <T>(items: readonly T[], limit: number): T[] => {
  if (items.length <= limit) return [...items]
  const step = items.length / limit
  return Array.from(
    { length: limit },
    (_, i) => items[Math.floor(i * step)],
  ).filter((item): item is T => item !== undefined)
}

/** Base tokens the whole curve sells before graduation. */
export const curveTokensOf = (parameters: ConfigParameters): BN =>
  getBaseTokenForSwap(
    parameters.sqrtStartPrice,
    getMigrationThresholdPrice(
      parameters.migrationQuoteThreshold,
      parameters.sqrtStartPrice,
      parameters.curve,
    ),
    parameters.curve,
  )

/**
 * The figures one pool account gives, for a config with this migration `threshold` whose
 * curve sells `curveTokens`. Fees taken in the launched token are valued at the curve's
 * average price (threshold ÷ tokens sold), not its last price: a curve can end far above
 * what its tokens actually sold for.
 */
export const poolRecord = (
  pool: VirtualPool,
  threshold: BN,
  curveTokens: BN,
  activationType: ActivationType,
): PoolRecord => {
  const state = pool.poolState
  const finished = state.finishCurveTimestamp.toNumber()
  const baseFees = state.metrics.totalTradingBaseFee
  return {
    quoteReserve: state.quoteReserve,
    tradingQuoteFees: state.metrics.totalTradingQuoteFee,
    tradingBaseFeesInQuote: curveTokens.isZero()
      ? new BN(0)
      : baseFees.mul(threshold).div(curveTokens),
    // Older pools predate the swap flag; holding quote or having graduated shows trading too.
    traded:
      state.hasSwap !== 0 ||
      state.isMigrated !== 0 ||
      !state.quoteReserve.isZero(),
    completed: state.quoteReserve.gte(threshold),
    migrated: state.isMigrated !== 0,
    // The finish time is a unix timestamp; only timestamp-activated pools share its unit.
    secondsToComplete:
      finished > 0 && activationType === ActivationType.Timestamp
        ? finished - state.activationPoint.toNumber()
        : null,
  }
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

/** The value below which `fraction` of the values fall (nearest rank); 0 for none. */
export const percentile = (
  values: readonly number[],
  fraction: number,
): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)] ?? 0
}

const medianOrNull = (values: readonly number[]): number | null =>
  values.length === 0 ? null : median(values)

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length

/** Aggregates the sampled pools of one config; amounts in SOL at the reference rate. */
export const summarizePools = (
  records: readonly PoolRecord[],
  totalPools: number,
  threshold: BN,
  quote: QuoteToken,
): RealLaunches => {
  const share = (predicate: (r: PoolRecord) => boolean): number =>
    records.length === 0 ? 0 : records.filter(predicate).length / records.length
  const toSol = (units: BN): number => solFromQuoteUnits(units, quote)
  // A migrated pool's reserve has moved to its new pool; it raised the threshold.
  const raised = records.map((r) =>
    toSol(r.migrated ? threshold : r.quoteReserve),
  )
  const tractionLevel = toSol(threshold) * TRACTION_SHARE
  const curveFees = records.map((r) =>
    toSol(r.tradingQuoteFees.add(r.tradingBaseFeesInQuote)),
  )
  return {
    totalPools,
    sampledPools: records.length,
    completedShare: share((r) => r.completed || r.migrated),
    migratedShare: share((r) => r.migrated),
    neverTradedShare: share((r) => !r.traded),
    tractionShare: share(
      (r) =>
        r.completed || r.migrated || toSol(r.quoteReserve) >= tractionLevel,
    ),
    medianRaised: median(raised),
    meanRaised: mean(raised),
    medianSecondsToComplete: medianOrNull(
      records.flatMap((r) =>
        r.secondsToComplete === null ? [] : [r.secondsToComplete],
      ),
    ),
    meanCurveFees: mean(curveFees),
    medianCurveFees: median(curveFees),
    p75CurveFees: percentile(curveFees, P75),
  }
}
