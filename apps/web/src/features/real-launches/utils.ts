import type BN from 'bn.js'
import { ActivationType } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { VirtualPool } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { PRICE_X128_SHIFT } from '../../core/launch-simulator'
import { solFromQuoteUnits } from '../../core/quote-token'
import type { QuoteToken } from '../../core/quote-token'
import { TRACTION_SHARE } from './constants'
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

/** The figures one pool account gives; `threshold` is the config's migration threshold. */
export const poolRecord = (
  pool: VirtualPool,
  threshold: BN,
  activationType: ActivationType,
): PoolRecord => {
  const state = pool.poolState
  const finished = state.finishCurveTimestamp.toNumber()
  const price = state.sqrtPrice.mul(state.sqrtPrice)
  const baseFees = state.metrics.totalTradingBaseFee
  return {
    quoteReserve: state.quoteReserve,
    tradingQuoteFees: state.metrics.totalTradingQuoteFee,
    tradingBaseFeesInQuote: baseFees.mul(price).shrn(PRICE_X128_SHIFT),
    traded: state.hasSwap !== 0,
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
    meanCurveFees: mean(
      records.map((r) =>
        toSol(r.tradingQuoteFees.add(r.tradingBaseFeesInQuote)),
      ),
    ),
  }
}
