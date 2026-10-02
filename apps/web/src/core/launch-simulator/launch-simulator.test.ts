import BN from 'bn.js'
import { describe, expect, it } from 'vitest'
import {
  BaseFeeMode,
  swapQuotePartialFill,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { compileLaunchConfig, DEFAULT_LAUNCH_CONFIG } from '../launch-config'
import type { LaunchConfig } from '../launch-config'
import {
  FeeToken,
  simulateLaunch,
  TradeSide,
  TradeStatus,
  unsupportedReason,
  Venue,
} from '.'
import type { Trade } from '.'
import { toInitialPool, toPoolConfig } from './utils'

const SOL = new BN(1_000_000_000)

const compile = (config: LaunchConfig) => {
  const compiled = compileLaunchConfig(config)
  if (!compiled.ok) throw new Error(compiled.reason)
  return compiled.parameters
}

const buy = (at: number, sol: number, trader = 'human'): Trade => ({
  at,
  side: TradeSide.Buy,
  amountIn: SOL.muln(sol),
  trader,
})

const ANTI_SNIPE: LaunchConfig = {
  ...DEFAULT_LAUNCH_CONFIG,
  fee: {
    ...DEFAULT_LAUNCH_CONFIG.fee,
    baseFeeParams: {
      baseFeeMode: BaseFeeMode.FeeSchedulerExponential,
      feeSchedulerParam: {
        startingFeeBps: 5000,
        endingFeeBps: 100,
        numberOfPeriod: 60,
        totalDuration: 60,
      },
    },
  },
}

describe('simulateLaunch', () => {
  it('matches the SDK quote for a single trade', () => {
    const parameters = compile(DEFAULT_LAUNCH_CONFIG)
    const expected = swapQuotePartialFill(
      toInitialPool(parameters),
      toPoolConfig(parameters),
      false,
      SOL,
      0,
      false,
      new BN(0),
      false,
    )

    const [outcome] = simulateLaunch(parameters, [buy(0, 1)]).outcomes

    expect(outcome.amountOut.eq(expected.outputAmount)).toBe(true)
    expect(outcome.fee.protocol.eq(expected.protocolFee)).toBe(true)
  })

  it('is deterministic', () => {
    const parameters = compile(DEFAULT_LAUNCH_CONFIG)
    const trades: Trade[] = [
      buy(0, 2),
      buy(3, 1),
      { at: 10, side: TradeSide.SellAll, trader: 'human' },
    ]
    const out = (r: ReturnType<typeof simulateLaunch>) =>
      r.outcomes.map((o) => o.amountOut.toString())

    expect(out(simulateLaunch(parameters, trades))).toEqual(
      out(simulateLaunch(parameters, trades)),
    )
  })

  it('graduates at the threshold and keeps trading on the migrated pool', () => {
    const result = simulateLaunch(compile(DEFAULT_LAUNCH_CONFIG), [
      buy(0, 50),
      buy(1, 50),
      buy(2, 1),
    ])

    expect(result.graduatedAt).toBe(1)
    expect(result.outcomes.map((o) => [o.status, o.venue])).toEqual([
      [TradeStatus.Filled, Venue.Curve],
      [TradeStatus.PartiallyFilled, Venue.Curve],
      [TradeStatus.Filled, Venue.Migrated],
    ])
    expect(result.migratedPool).not.toBeNull()
  })

  it('carries the price across graduation without a jump', () => {
    const parameters = compile(DEFAULT_LAUNCH_CONFIG)
    const result = simulateLaunch(parameters, [buy(0, 50), buy(1, 50)])
    const migrationSqrtPrice = toPoolConfig(parameters).migrationSqrtPrice
    expect(result.outcomes[1].sqrtPriceAfter.eq(migrationSqrtPrice)).toBe(true)
    expect(result.migratedPool?.sqrtPrice.eq(migrationSqrtPrice)).toBe(true)
  })

  it('collects post-graduation fees separately, split by LP share', () => {
    const result = simulateLaunch(compile(DEFAULT_LAUNCH_CONFIG), [
      buy(0, 50),
      buy(1, 50),
      buy(2, 5),
    ])
    const after = result.migratedFees[FeeToken.Quote]
    expect(after.partner.add(after.creator).gtn(0)).toBe(true)
    expect(after.partner.eq(after.creator)).toBe(true) // default config splits LP 50/50
  })

  it('refuses post-graduation trades on a migrated pool it cannot reproduce, with a reason', () => {
    const parameters = compile(DEFAULT_LAUNCH_CONFIG)
    const compounding = {
      ...parameters,
      migratedPoolFee: { ...parameters.migratedPoolFee, collectFeeMode: 2 },
    }
    const result = simulateLaunch(compounding, [
      buy(0, 50),
      buy(1, 50),
      buy(2, 1),
    ])
    expect(result.outcomes[2].status).toBe(TradeStatus.Rejected)
    expect(result.outcomes[2].reason).toContain('Migrated pool not simulated')
  })

  it('sells a whole holding on sell-all and rejects overselling', () => {
    const result = simulateLaunch(compile(DEFAULT_LAUNCH_CONFIG), [
      buy(0, 1, 'a'),
      { at: 5, side: TradeSide.SellAll, trader: 'a' },
      { at: 6, side: TradeSide.Sell, amountIn: new BN(1), trader: 'a' },
    ])

    expect(result.outcomes.map((o) => o.status)).toEqual([
      TradeStatus.Filled,
      TradeStatus.Filled,
      TradeStatus.Rejected,
    ])
    expect(
      result.outcomes[1].amountInUsed.eq(result.outcomes[0].amountOut),
    ).toBe(true)
    expect(result.holdings['a'].isZero()).toBe(true)
  })

  it('charges an early buyer more than a late one under a falling fee schedule', () => {
    const parameters = compile(ANTI_SNIPE)
    const [early] = simulateLaunch(parameters, [buy(0, 1)]).outcomes
    const [late] = simulateLaunch(parameters, [buy(120, 1)]).outcomes

    expect(early.fee.protocol.gt(late.fee.protocol.muln(10))).toBe(true)
  })

  it('refuses a dynamic-fee config instead of simulating it wrongly', () => {
    const parameters = compile({
      ...DEFAULT_LAUNCH_CONFIG,
      fee: { ...DEFAULT_LAUNCH_CONFIG.fee, dynamicFeeEnabled: true },
    })

    expect(unsupportedReason(parameters)).not.toBeNull()
    expect(() => simulateLaunch(parameters, [buy(0, 1)])).toThrow()
  })
})
