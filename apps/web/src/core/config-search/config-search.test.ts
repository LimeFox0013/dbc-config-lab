import { describe, expect, it } from 'vitest'
import { BaseFeeMode } from '@meteora-ag/dynamic-bonding-curve-sdk'
import {
  compileLaunchConfig,
  CurveShape,
  DEFAULT_LAUNCH_CONFIG,
  FLAT_SCHEDULE,
  withCurve,
  withQuoteToken,
} from '../launch-config'
import {
  DEFAULT_SCENARIO,
  SCENARIO_PRESETS,
  ScenarioPresetId,
} from '../sniper-scenario'
import type { ScenarioSpec } from '../sniper-scenario'
import { QuoteToken } from '../quote-token'
import {
  anchoredCurves,
  Criterion,
  curveVariantsFor,
  DEFAULT_CURVE_VARIANTS,
  objectiveOf,
  sanitizeObjective,
  searchConfigs,
} from '.'
import type { MeanMetrics, Objective, SearchSpace } from '.'
import { scoreCandidates } from './utils'

const SMALL_SPACE: SearchSpace = {
  modes: [BaseFeeMode.FeeSchedulerLinear],
  startingFeeBps: [5000, 9000],
  windowSeconds: [10, 60],
}

const search = (
  objective: Objective,
  scenario: ScenarioSpec = DEFAULT_SCENARIO,
  space = SMALL_SPACE,
) =>
  searchConfigs({
    base: DEFAULT_LAUNCH_CONFIG,
    objective,
    scenario,
    seeds: [1, 2, 3],
    space,
    curves: [],
  })

const HUMANS = objectiveOf({ [Criterion.HumanOutcome]: 1 })

const metrics = (overrides: Partial<MeanMetrics>): MeanMetrics => ({
  sniperProfit: 0,
  adaptiveSniperProfit: 0,
  humanProfit: 0,
  humanFees: 0,
  partnerCreatorFees: 0,
  postGraduationFees: 0,
  graduationRate: 0,
  meanGraduationSeconds: null,
  raised: 0,
  maxDrawdownPercent: 0,
  botShareOfEarlyBuys: null,
  arbitrageProfit: 0,
  ...overrides,
})

describe('searchConfigs', () => {
  it('ranks the flat baseline plus every schedule, best score first, scores within 0–1', () => {
    const { candidates } = search(HUMANS)
    expect(candidates).toHaveLength(1 + 4)
    const scores = candidates.map((c) => c.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
    expect(scores.every((s) => s >= 0 && s <= 1)).toBe(true)
    expect(candidates.some((c) => c.schedule === FLAT_SCHEDULE)).toBe(true)
  })

  it('only proposes configs that pass validation, keeping the rest of the base config', () => {
    const { candidates } = search(HUMANS)
    expect(candidates.every((c) => compileLaunchConfig(c.config).ok)).toBe(true)
    expect(candidates[0].config.token).toEqual(DEFAULT_LAUNCH_CONFIG.token)
  })

  it('is deterministic', () => {
    expect(search(HUMANS).candidates.map((c) => c.score)).toEqual(
      search(HUMANS).candidates.map((c) => c.score),
    )
  })

  it('favours a long, high-fee window when only fee income counts', () => {
    const [best] = search(objectiveOf({ [Criterion.FeeIncome]: 1 })).candidates
    expect(best.schedule).toMatchObject({
      windowSeconds: 60,
      startingFeeBps: 9000,
    })
  })

  it('says a graduation goal cannot decide when no candidate ever graduates', () => {
    const result = search(objectiveOf({ [Criterion.Graduation]: 1 }))
    expect(result.indistinguishable).toBe(true)
  })

  it('can rank graduation where launches do graduate', () => {
    const result = search(
      objectiveOf({ [Criterion.Graduation]: 1 }),
      SCENARIO_PRESETS[ScenarioPresetId.Hype],
    )
    expect(result.indistinguishable).toBe(false)
    expect(result.candidates[0].metrics.graduationRate).toBe(1)
  })
})

describe('scoreCandidates', () => {
  it('does not let a criterion dominate because of its units', () => {
    // A wins humans by 0.1 SOL; B wins raise by 1000 SOL. Equal weights → equal scores.
    const a = metrics({ humanProfit: 0.1, raised: 0 })
    const b = metrics({ humanProfit: 0, raised: 1000 })
    const { scores } = scoreCandidates(
      [a, b],
      objectiveOf({ [Criterion.HumanOutcome]: 1, [Criterion.Raise]: 1 }),
    )
    expect(scores[0]).toBeCloseTo(scores[1])
  })

  it('ignores rounding-level differences instead of stretching them into a ranking', () => {
    const a = metrics({ raised: 85 })
    const b = metrics({ raised: 85.000001 })
    const result = scoreCandidates(
      [a, b],
      objectiveOf({ [Criterion.Raise]: 1 }),
    )
    expect(result.undecided).toEqual([Criterion.Raise])
    expect(result.scores).toEqual([0, 0])
  })

  it('treats lower as better where it should', () => {
    const calm = metrics({ maxDrawdownPercent: 5 })
    const wild = metrics({ maxDrawdownPercent: 60 })
    const { scores } = scoreCandidates(
      [calm, wild],
      objectiveOf({ [Criterion.PriceStability]: 1 }),
    )
    expect(scores[0]).toBeGreaterThan(scores[1])
  })

  it('scores a missing value as worst on that criterion', () => {
    const graduated = metrics({ graduationRate: 1, meanGraduationSeconds: 60 })
    const never = metrics({})
    const { scores } = scoreCandidates(
      [graduated, never],
      objectiveOf({ [Criterion.Graduation]: 1 }),
    )
    expect(scores).toEqual([1, 0])
  })
})

describe('objectives', () => {
  it('objectiveOf fills unnamed criteria with 0', () => {
    expect(objectiveOf({ [Criterion.Raise]: 1 })[Criterion.HumanOutcome]).toBe(
      0,
    )
  })

  it('sanitizeObjective clamps weights into [0, 1]', () => {
    const clamped = sanitizeObjective(
      objectiveOf({
        [Criterion.HumanOutcome]: 5,
        [Criterion.BotDeterrence]: -1,
        [Criterion.FeeIncome]: Number.NaN,
      }),
    )
    expect([
      clamped[Criterion.HumanOutcome],
      clamped[Criterion.BotDeterrence],
      clamped[Criterion.FeeIncome],
    ]).toEqual([1, 0, 0])
  })
})

describe('curve search on a config priced in USDC', () => {
  it('re-prices the SOL curve variants into USDC before trying them', () => {
    const result = searchConfigs({
      base: withQuoteToken(DEFAULT_LAUNCH_CONFIG, QuoteToken.Usdc),
      objective: objectiveOf({ [Criterion.HumanOutcome]: 1 }),
      scenario: DEFAULT_SCENARIO,
      seeds: [1],
      space: {
        modes: [BaseFeeMode.FeeSchedulerLinear],
        startingFeeBps: [100],
        windowSeconds: [0],
      },
      curves: DEFAULT_CURVE_VARIANTS.slice(0, 1),
    })
    const tried = result.candidates.flatMap((c) => (c.curve ? [c.curve] : []))
    expect(tried.length).toBeGreaterThan(0)
    tried.forEach((curve) =>
      expect(curve).toEqual({
        ...DEFAULT_CURVE_VARIANTS[0],
        migrationQuoteThreshold: 6000,
      }),
    )
    result.candidates.forEach((c) =>
      expect(c.config.quoteToken).toBe(QuoteToken.Usdc),
    )
  })
})

describe('price-anchored curves', () => {
  it('open below the outside market cap and graduate above where they open', () => {
    const curves = anchoredCurves(300)
    expect(curves.length).toBeGreaterThan(0)
    curves.forEach((curve) => {
      expect(curve.curveShape).toBe(CurveShape.MarketCap)
      if (curve.curveShape !== CurveShape.MarketCap) return
      expect(curve.initialMarketCap).toBeLessThan(300)
      expect(curve.migrationMarketCap).toBeGreaterThan(curve.initialMarketCap)
    })
  })

  it('replace the general variants only when traders know an outside price', () => {
    const stock = SCENARIO_PRESETS[ScenarioPresetId.StockListing]
    expect(curveVariantsFor(stock)).toEqual(
      anchoredCurves(stock.arbitrageurs.fairMarketCapSol),
    )
    expect(curveVariantsFor(DEFAULT_SCENARIO)).toBe(DEFAULT_CURVE_VARIANTS)
  })

  it('every one compiles', () => {
    anchoredCurves(300).forEach((curve) =>
      expect(
        compileLaunchConfig(withCurve(DEFAULT_LAUNCH_CONFIG, curve)).ok,
      ).toBe(true),
    )
  })
})

describe('fair-price criterion', () => {
  it('ranks the candidate arbitrage traders take least from first', () => {
    const { scores } = scoreCandidates(
      [metrics({ arbitrageProfit: 12 }), metrics({ arbitrageProfit: 4 })],
      objectiveOf({ [Criterion.FairPrice]: 1 }),
    )
    expect(scores[1]).toBeGreaterThan(scores[0] ?? 0)
  })

  it('cannot rank in a situation without arbitrage traders', () => {
    const { undecided } = scoreCandidates(
      [metrics({}), metrics({ humanProfit: 1 })],
      objectiveOf({ [Criterion.FairPrice]: 1 }),
    )
    expect(undecided).toEqual([Criterion.FairPrice])
  })
})
