import BN from 'bn.js'
import { describe, expect, it } from 'vitest'
import type { VirtualPool } from '@meteora-ag/dynamic-bonding-curve-sdk'
import {
  compileLaunchConfig,
  DEFAULT_LAUNCH_CONFIG,
} from '../../core/launch-config'
import { toInitialPool } from '../../core/launch-simulator'
import { QuoteToken } from '../../core/quote-token'
import {
  operatorConfig,
  operatorTotals,
  OperatorRejection,
  scaledPositionFees,
  fetchOperatorReport,
} from '.'
import { curveTokensOf } from '../real-launches'
import { connectionFor } from '../../core/config-deploy'
import { SolanaNetwork } from '../../core/shared'

const compiled = compileLaunchConfig(DEFAULT_LAUNCH_CONFIG)
if (!compiled.ok) throw new Error(compiled.reason)
const parameters = { ...compiled.parameters, creatorTradingFeePercentage: 25 }
const SOL = 1_000_000_000

const pool = (
  tradingQuoteFee: number,
  partnerQuoteFee: number,
  migrated: boolean,
  tradingBaseFee = new BN(0),
): VirtualPool => {
  const initial = toInitialPool(parameters)
  return {
    poolState: {
      ...initial.poolState,
      isMigrated: migrated ? 1 : 0,
      partnerQuoteFee: new BN(partnerQuoteFee),
      metrics: {
        ...initial.poolState.metrics,
        totalTradingQuoteFee: new BN(tradingQuoteFee),
        totalTradingBaseFee: tradingBaseFee,
      },
    },
  }
}

describe('operatorConfig', () => {
  it('credits the fee wallet its share of every pool’s curve fees and counts graduations', () => {
    const row = operatorConfig(
      'config',
      [pool(2 * SOL, SOL / 2, true), pool(2 * SOL, 0, false)],
      QuoteToken.Sol,
      parameters,
    )
    expect(row).toMatchObject({ launches: 2, graduated: 1 })
    expect(row.curveFeesSol).toBeCloseTo(3) // 75% of 4 SOL
    expect(row.unclaimedSol).toBeCloseTo(0.5)
  })

  it('values fees in the launched token at the curve’s average price', () => {
    const curveTokens = curveTokensOf(parameters)
    // Every token the curve sells, as a fee, is worth the whole threshold.
    const row = operatorConfig(
      'config',
      [pool(0, 0, true, curveTokens)],
      QuoteToken.Sol,
      parameters,
    )
    expect(row.curveFeesSol).toBeCloseTo(
      (parameters.migrationQuoteThreshold.toNumber() / SOL) * 0.75,
    )
  })

  it('leaves an unpriced quote token unpriced', () => {
    expect(
      operatorConfig('config', [pool(SOL, SOL, false)], null, parameters),
    ).toMatchObject({ curveFeesSol: null, unclaimedSol: null })
  })
})

describe('scaledPositionFees', () => {
  it('scales a sample to every held position', () => {
    expect(scaledPositionFees(2, 100, 400)).toBe(8)
    expect(scaledPositionFees(2, 400, 400)).toBe(2)
    expect(scaledPositionFees(0, 0, 0)).toBe(0)
  })
})

describe('operatorTotals', () => {
  it('sums configs and positions, counting unpriced ones as nothing', () => {
    expect(
      operatorTotals({
        owner: 'owner',
        readAt: '2026-10-03T00:00:00.000Z',
        configs: [
          {
            config: 'a',
            quoteToken: QuoteToken.Sol,
            launches: 3,
            graduated: 1,
            curveFeesSol: 1,
            unclaimedSol: 0.5,
          },
          {
            config: 'b',
            quoteToken: null,
            launches: 2,
            graduated: 2,
            curveFeesSol: null,
            unclaimedSol: null,
          },
        ],
        positions: [
          { quoteToken: QuoteToken.Sol, held: 3, read: 3, feesSol: 2 },
        ],
      }),
    ).toEqual({
      launches: 5,
      graduated: 3,
      curveFeesSol: 1,
      unclaimedSol: 0.5,
      afterGraduationSol: 2,
    })
  })
})

describe('fetchOperatorReport', () => {
  it('refuses what is not an address before reading anything', async () => {
    expect(
      await fetchOperatorReport(
        connectionFor(SolanaNetwork.Devnet),
        SolanaNetwork.Devnet,
        'not an address',
      ),
    ).toEqual({ ok: false, rejection: OperatorRejection.InvalidAddress })
  })
})
