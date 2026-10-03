import BN from 'bn.js'
import { describe, expect, it } from 'vitest'
import {
  BaseFeeMode,
  swapQuotePartialFill,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { compileLaunchConfig, DEFAULT_LAUNCH_CONFIG } from '../launch-config'
import type { LaunchConfig } from '../launch-config'
import { FeeToken, simulateLaunch, TradeSide, TradeStatus, Venue } from '.'
import type { Trade } from '.'
import {
  deltaBinId,
  feeTotal,
  feeValueInQuote,
  toInitialPool,
  toPoolConfig,
} from './utils'

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
    // The DAMM v2 dynamic fee on the migrated pool is not replayed.
    const dynamicFee = {
      ...parameters,
      migratedPoolFee: { ...parameters.migratedPoolFee, dynamicFee: 1 },
    }
    const result = simulateLaunch(dynamicFee, [
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

  describe('dynamic fee', () => {
    const withDynamicFee = (dynamicFeeEnabled: boolean) =>
      compile({
        ...DEFAULT_LAUNCH_CONFIG,
        fee: { ...DEFAULT_LAUNCH_CONFIG.fee, dynamicFeeEnabled },
      })
    const feesOf = (dynamicFeeEnabled: boolean, trades: Trade[]): BN[] =>
      simulateLaunch(withDynamicFee(dynamicFeeEnabled), trades).outcomes.map(
        (outcome) => feeTotal(outcome.fee),
      )

    it('adds a capped volatility fee after a large price move', () => {
      const trades = [buy(0, 20), buy(1, 1)]
      const [firstBase, secondBase] = feesOf(false, trades)
      const [firstDynamic, secondDynamic] = feesOf(true, trades)

      expect(firstDynamic?.eq(firstBase ?? new BN(0))).toBe(true)
      expect(secondDynamic?.gt(secondBase ?? new BN(0))).toBe(true)
      // The SDK's default dynamic-fee parameters cap the extra at 20% of the base fee.
      expect(
        secondDynamic?.lte((secondBase ?? new BN(0)).muln(12).divn(10)),
      ).toBe(true)
    })

    it('partly decays the extra within the decay window', () => {
      const [, raised, decayed] = feesOf(true, [
        buy(0, 20),
        buy(20, 1),
        buy(21, 1),
      ])
      const [, base] = feesOf(false, [buy(0, 20), buy(20, 1)])

      expect(decayed?.lt(raised ?? new BN(0))).toBe(true)
      expect(decayed?.gt(base ?? new BN(0))).toBe(true)
    })

    it('drops the extra after a pause past the decay period, one trade later as on chain', () => {
      const [, stillRaised, reset] = feesOf(true, [
        buy(0, 20),
        buy(1000, 1),
        buy(1001, 1),
      ])
      const [, raised] = feesOf(true, [buy(0, 20), buy(1, 1)])
      const [, base] = feesOf(false, [buy(0, 20), buy(1000, 1)])

      expect(stillRaised?.eq(raised ?? new BN(0))).toBe(true)
      expect(reset?.lt((base ?? new BN(0)).muln(102).divn(100))).toBe(true)
    })

    it('counts bins symmetrically and none for an unchanged price', () => {
      const { dynamicFee } = withDynamicFee(true).poolFees
      if (!dynamicFee) throw new Error('dynamic fee expected')
      const low = new BN(2).pow(new BN(64))
      const high = low.muln(101).divn(100)

      expect(deltaBinId(dynamicFee.binStepU128, low, low).isZero()).toBe(true)
      expect(
        deltaBinId(dynamicFee.binStepU128, low, high).eq(
          deltaBinId(dynamicFee.binStepU128, high, low),
        ),
      ).toBe(true)
    })
  })
})

describe('feeValueInQuote', () => {
  const shares = (partner: number, protocol: number) => ({
    partner: new BN(partner),
    creator: new BN(0),
    protocol: new BN(protocol),
    referral: new BN(0),
  })

  it('passes a quote-token fee through unchanged', () => {
    const fee = shares(80, 20)
    expect(
      feeValueInQuote(fee, FeeToken.Quote, true, new BN(10_000), new BN(5)),
    ).toBe(fee)
  })

  it('values a base-token fee on a buy at the price the buyer paid', () => {
    // 1,000 lamports bought 990 tokens plus a 10-token fee: 1 lamport per token.
    const value = feeValueInQuote(
      shares(8, 2),
      FeeToken.Base,
      true,
      new BN(1_000),
      new BN(990),
    )
    expect(value.partner.toNumber()).toBe(8)
    expect(value.protocol.toNumber()).toBe(2)
  })

  it('values a base-token fee on a sell at the price the seller got', () => {
    // 1,000 tokens in, 10 of them fee, 1,980 lamports out: 2 lamports per token.
    const value = feeValueInQuote(
      shares(10, 0),
      FeeToken.Base,
      false,
      new BN(1_000),
      new BN(1_980),
    )
    expect(value.partner.toNumber()).toBe(20)
  })

  it('values a fee as nothing when the trade moved nothing', () => {
    const value = feeValueInQuote(
      shares(10, 0),
      FeeToken.Base,
      true,
      new BN(0),
      new BN(0),
    )
    expect(value.partner.isZero()).toBe(true)
  })
})
