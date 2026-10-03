import BN from 'bn.js'
import type {
  ConfigParameters,
  VirtualPool,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { solFromQuoteUnits } from '../../core/quote-token'
import type { QuoteToken } from '../../core/quote-token'
import { PERCENT } from '../../core/shared'
import { curveTokensOf, poolRecord } from '../real-launches'
import type { OperatorConfig, OperatorReport, OperatorTotals } from './types'

/**
 * One config's figures from all its pools. Trading fees taken in the launched token —
 * lifetime and unclaimed alike — are valued at the curve's average price, as real-launches
 * values them, so the unclaimed part is measured the same way as the whole.
 */
export const operatorConfig = (
  config: string,
  pools: readonly VirtualPool[],
  quoteToken: QuoteToken | null,
  parameters: ConfigParameters,
): OperatorConfig => {
  const threshold = parameters.migrationQuoteThreshold
  const curveTokens = curveTokensOf(parameters)
  const records = pools.map((pool) =>
    poolRecord(pool, threshold, curveTokens, parameters.activationType),
  )
  const sum = (values: BN[]): BN =>
    values.reduce((total, value) => total.add(value), new BN(0))
  const lifetime = sum(
    records.map((r) => r.tradingQuoteFees.add(r.tradingBaseFeesInQuote)),
  )
  const atAveragePrice = (base: BN): BN =>
    curveTokens.isZero() ? new BN(0) : base.mul(threshold).div(curveTokens)
  const unclaimed = sum(
    pools.map(({ poolState }) =>
      poolState.partnerQuoteFee.add(atAveragePrice(poolState.partnerBaseFee)),
    ),
  )
  const partnerShare =
    (PERCENT - parameters.creatorTradingFeePercentage) / PERCENT
  return {
    config,
    quoteToken,
    launches: pools.length,
    graduated: records.filter((r) => r.migrated).length,
    curveFeesSol: quoteToken
      ? solFromQuoteUnits(lifetime, quoteToken) * partnerShare
      : null,
    unclaimedSol: quoteToken ? solFromQuoteUnits(unclaimed, quoteToken) : null,
  }
}

/** Fees of `read` positions, scaled to all `held` when only a sample was read. */
export const scaledPositionFees = (
  feesSol: number,
  read: number,
  held: number,
): number => (read === 0 ? 0 : (feesSol * held) / read)

export const operatorTotals = (report: OperatorReport): OperatorTotals => ({
  launches: report.configs.reduce((sum, c) => sum + c.launches, 0),
  graduated: report.configs.reduce((sum, c) => sum + c.graduated, 0),
  curveFeesSol: report.configs.reduce(
    (sum, c) => sum + (c.curveFeesSol ?? 0),
    0,
  ),
  unclaimedSol: report.configs.reduce(
    (sum, c) => sum + (c.unclaimedSol ?? 0),
    0,
  ),
  afterGraduationSol: report.positions.reduce((sum, p) => sum + p.feesSol, 0),
})
