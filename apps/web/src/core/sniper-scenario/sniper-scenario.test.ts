import { describe, expect, it } from 'vitest'
import {
  BaseFeeMode,
  CollectFeeMode,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import {
  compileLaunchConfig,
  DEFAULT_LAUNCH_CONFIG,
  LAUNCH_PRESETS,
} from '../launch-config'
import type { LaunchConfig } from '../launch-config'
import BN from 'bn.js'
import { baseFeeBpsAt, TradeSide } from '../launch-simulator'
import {
  DEFAULT_SCENARIO,
  generateTrades,
  runScenario,
  SCENARIO_PRESETS,
  scenarioMetrics,
  TraderGroup,
} from '.'

const compile = (config: LaunchConfig) => {
  const compiled = compileLaunchConfig(config)
  if (!compiled.ok) throw new Error(compiled.reason)
  return compiled.parameters
}

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

const summary = (config: LaunchConfig) =>
  Object.values(runScenario(compile(config), DEFAULT_SCENARIO).groups).map(
    (g) => [g.group, g.spent.toString(), g.profit.toString()],
  )

describe('runScenario', () => {
  it('reproduces exactly from the same seed', () => {
    expect(summary(DEFAULT_LAUNCH_CONFIG)).toEqual(
      summary(DEFAULT_LAUNCH_CONFIG),
    )
  })

  it('generates different trades for a different seed', () => {
    const at = (seed: number) =>
      generateTrades({ ...DEFAULT_SCENARIO, seed }, () => 0).map((t) => t.at)
    expect(at(1)).not.toEqual(at(2))
  })

  it('makes sniping less profitable under a falling fee schedule than under a flat fee', () => {
    const sniperProfit = (config: LaunchConfig) =>
      runScenario(compile(config), DEFAULT_SCENARIO).groups[TraderGroup.Sniper]
        .profit

    expect(
      sniperProfit(ANTI_SNIPE).lt(sniperProfit(DEFAULT_LAUNCH_CONFIG)),
    ).toBe(true)
  })

  it('accounts for every sniper sell', () => {
    const { simulation, groups } = runScenario(
      compile(DEFAULT_LAUNCH_CONFIG),
      DEFAULT_SCENARIO,
    )
    const sniperSells = simulation.outcomes.filter(
      (o) =>
        o.trade.trader.startsWith(TraderGroup.Sniper) &&
        o.amountOut.gtn(0) &&
        o.trade.side === TradeSide.SellAll,
    )

    expect(sniperSells).toHaveLength(DEFAULT_SCENARIO.snipers.count)
    expect(groups[TraderGroup.Sniper].tokensHeld.isZero()).toBe(true)
  })

  it('sniper shield leaves humans better off than the flat fee, across seeds', () => {
    const preset = (id: string) => {
      const found = LAUNCH_PRESETS.find((p) => p.id === id)
      if (!found) throw new Error(`missing preset ${id}`)
      return compile(found.config)
    }
    const meanHumanProfit = (parameters: ReturnType<typeof compile>) =>
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        .map(
          (seed) =>
            runScenario(parameters, { ...DEFAULT_SCENARIO, seed }).groups[
              TraderGroup.Human
            ].profit,
        )
        .reduce((a, b) => a.add(b))

    expect(
      meanHumanProfit(preset('sniper-shield')).gt(
        meanHumanProfit(preset('flat')),
      ),
    ).toBe(true)
  })
})

describe('adaptive snipers', () => {
  const withAdaptive = {
    ...DEFAULT_SCENARIO,
    adaptiveSnipers: { ...DEFAULT_SCENARIO.adaptiveSnipers, count: 3 },
  }
  const adaptiveBuyTimes = (config: LaunchConfig) =>
    runScenario(compile(config), withAdaptive)
      .simulation.outcomes.filter(
        (o) =>
          o.trade.trader.startsWith(TraderGroup.AdaptiveSniper) &&
          o.trade.side === TradeSide.Buy,
      )
      .map((o) => o.trade.at)

  it('buys at once when the fee is already low', () => {
    expect(adaptiveBuyTimes(DEFAULT_LAUNCH_CONFIG)).toEqual([0, 0, 0])
  })

  it('waits until the program fee for its buy falls to its limit', () => {
    const times = adaptiveBuyTimes(ANTI_SNIPE)
    expect(times.every((t) => t > 0)).toBe(true)
    const parameters = compile(ANTI_SNIPE)
    const buys = runScenario(
      parameters,
      withAdaptive,
    ).simulation.outcomes.filter(
      (o) =>
        o.trade.trader.startsWith(TraderGroup.AdaptiveSniper) &&
        o.trade.side === TradeSide.Buy,
    )
    buys.forEach((o) => {
      expect(
        o.trade.side === TradeSide.Buy &&
          baseFeeBpsAt(parameters, o.trade.at, o.trade.amountIn),
      ).toBeLessThanOrEqual(withAdaptive.adaptiveSnipers.maxFeeBps)
    })
  })

  it('draws the same amounts under every config', () => {
    const amounts = (config: LaunchConfig) =>
      runScenario(compile(config), withAdaptive)
        .simulation.outcomes.filter((o) => o.trade.side === TradeSide.Buy)
        .map((o) =>
          o.trade.side === TradeSide.Buy ? o.trade.amountIn.toString() : '',
        )
        .sort()
    expect(amounts(ANTI_SNIPE)).toEqual(amounts(DEFAULT_LAUNCH_CONFIG))
  })

  it('profits more than a first-second sniper under a steep fee window', () => {
    const { groups } = runScenario(compile(ANTI_SNIPE), {
      ...withAdaptive,
      adaptiveSnipers: { ...withAdaptive.adaptiveSnipers, count: 5 },
    })
    expect(
      groups[TraderGroup.AdaptiveSniper].profit.gt(
        groups[TraderGroup.Sniper].profit,
      ),
    ).toBe(true)
  })
})

describe('scenario presets', () => {
  it.each(Object.entries(SCENARIO_PRESETS))(
    '%s runs against every built-in config',
    (_, spec) => {
      LAUNCH_PRESETS.forEach((preset) => {
        expect(() => runScenario(compile(preset.config), spec)).not.toThrow()
      })
    },
  )
})

describe('baseFeeBpsAt', () => {
  it('reads the program fee: flat 1%, and 50% at launch under the anti-snipe schedule', () => {
    const amount = new BN(1_000_000_000)
    expect(baseFeeBpsAt(compile(DEFAULT_LAUNCH_CONFIG), 0, amount)).toBe(100)
    expect(baseFeeBpsAt(compile(ANTI_SNIPE), 0, amount)).toBe(5000)
    expect(baseFeeBpsAt(compile(ANTI_SNIPE), 600, amount)).toBe(100)
  })
})

describe('fees in either token', () => {
  const withCollectFeeMode = (
    collectFeeMode: CollectFeeMode,
  ): LaunchConfig => ({
    ...DEFAULT_LAUNCH_CONFIG,
    fee: { ...DEFAULT_LAUNCH_CONFIG.fee, collectFeeMode },
  })
  const SOL = 1_000_000_000

  it.each([CollectFeeMode.QuoteToken, CollectFeeMode.OutputToken])(
    'a flat fee costs humans its rate on the SOL they trade (collect fee mode %s)',
    (mode) => {
      const parameters = compile(withCollectFeeMode(mode))
      const { groups } = runScenario(parameters, DEFAULT_SCENARIO)
      const human = groups[TraderGroup.Human]
      const traded = human.spent.add(human.received).toNumber() / SOL
      const { humanFees } = scenarioMetrics(parameters, DEFAULT_SCENARIO)
      expect(humanFees / traded).toBeGreaterThan(0.0099)
      expect(humanFees / traded).toBeLessThan(0.0102)
    },
  )

  it('counts fees taken in the token as partner and creator income', () => {
    const quote = scenarioMetrics(
      compile(withCollectFeeMode(CollectFeeMode.QuoteToken)),
      DEFAULT_SCENARIO,
    )
    const output = scenarioMetrics(
      compile(withCollectFeeMode(CollectFeeMode.OutputToken)),
      DEFAULT_SCENARIO,
    )
    expect(output.partnerCreatorFees).toBeGreaterThan(
      quote.partnerCreatorFees * 0.9,
    )
    expect(output.partnerCreatorFees).toBeLessThan(
      quote.partnerCreatorFees * 1.1,
    )
  })
})
