import { Criterion } from '../../core/config-search'
import { describe, expect, it } from 'vitest'
import {
  compileLaunchConfig,
  CurveShape,
  DEFAULT_LAUNCH_CONFIG,
  LAUNCH_PRESETS,
  LaunchPresetId,
} from '../../core/launch-config'
import { DEFAULT_SEARCH_SEEDS, searchConfigs } from '../../core/config-search'
import {
  DEFAULT_SCENARIO,
  SCENARIO_PRESETS,
  ScenarioPresetId,
} from '../../core/sniper-scenario'
import {
  GOAL_OBJECTIVES,
  LaunchGoal,
  matchingPreset,
  PROPOSAL_COUNT,
  recommend,
} from '.'

describe('recommend', () => {
  const fair = recommend(
    DEFAULT_LAUNCH_CONFIG,
    GOAL_OBJECTIVES[LaunchGoal.FairLaunch],
    DEFAULT_SCENARIO,
  )

  it('returns the top proposals ranked, each a valid config', () => {
    expect(fair?.proposals).toHaveLength(PROPOSAL_COUNT)
    expect(fair?.proposals.map((p) => p.rank)).toEqual([1, 2, 3])
    expect(
      fair?.proposals.every((p) => compileLaunchConfig(p.candidate.config).ok),
    ).toBe(true)
  })

  it('measures each proposal against the flat fee from the same simulations', () => {
    const [best] = fair?.proposals ?? []
    expect(best.versusFlat.humanProfit).toBeCloseTo(
      best.candidate.metrics.humanProfit -
        (fair?.flat.metrics.humanProfit ?? 0),
    )
  })

  it('a fair-launch goal leaves humans better off than flat', () => {
    expect(fair?.proposals[0].versusFlat.humanProfit).toBeGreaterThan(0)
  })

  it('different goals can lead to different proposals', () => {
    const fees = recommend(
      DEFAULT_LAUNCH_CONFIG,
      GOAL_OBJECTIVES[LaunchGoal.FeeIncome],
      DEFAULT_SCENARIO,
    )
    expect(fees?.proposals[0].candidate.schedule).not.toEqual(
      fair?.proposals[0].candidate.schedule,
    )
  })
})

describe('matchingPreset', () => {
  it('finds a built-in preset with an identical config', () => {
    const shield = LAUNCH_PRESETS.find((p) => p.id === 'sniper-shield')
    expect(
      shield &&
        matchingPreset(structuredClone(shield.config), LAUNCH_PRESETS)?.id,
    ).toBe('sniper-shield')
  })

  it('finds nothing for a config no preset has', () => {
    const custom = { ...DEFAULT_LAUNCH_CONFIG, migrationQuoteThreshold: 42 }
    expect(matchingPreset(custom, LAUNCH_PRESETS)).toBeUndefined()
  })
})

describe('goals', () => {
  it.each(Object.values(LaunchGoal))(
    '%s produces a ranked recommendation in a hype launch',
    (goal) => {
      const result = recommend(
        DEFAULT_LAUNCH_CONFIG,
        GOAL_OBJECTIVES[goal],
        SCENARIO_PRESETS[ScenarioPresetId.Hype],
      )
      expect(result?.proposals.length).toBe(PROPOSAL_COUNT)
    },
  )

  it('graduate-fast reports that graduation cannot rank when no launch graduates', () => {
    const result = recommend(
      DEFAULT_LAUNCH_CONFIG,
      GOAL_OBJECTIVES[LaunchGoal.GraduateFast],
      DEFAULT_SCENARIO,
    )
    expect(result?.undecided).toContain(Criterion.Graduation)
    expect(result?.indistinguishable).toBe(false)
  })

  it('fair launch never leaves humans worse off than the flat fee (typical launch)', () => {
    const result = recommend(
      DEFAULT_LAUNCH_CONFIG,
      GOAL_OBJECTIVES[LaunchGoal.FairLaunch],
      DEFAULT_SCENARIO,
    )
    expect(result?.proposals[0].versusFlat.humanProfit).toBeGreaterThan(0)
  })
})

describe('curve search', () => {
  it('lets graduate-fast decide in a typical launch by finding a curve that graduates', () => {
    const result = recommend(
      DEFAULT_LAUNCH_CONFIG,
      GOAL_OBJECTIVES[LaunchGoal.GraduateFast],
      DEFAULT_SCENARIO,
      {
        includeCurves: true,
      },
    )
    expect(result?.undecided).not.toContain(Criterion.Graduation)
    expect(
      result?.proposals[0].candidate.metrics.graduationRate,
    ).toBeGreaterThan(0)
    expect(result?.proposals[0].candidate.curve).not.toBeNull()
  })

  it('keeps the flat baseline on the user’s own curve', () => {
    const result = recommend(
      DEFAULT_LAUNCH_CONFIG,
      GOAL_OBJECTIVES[LaunchGoal.FairLaunch],
      DEFAULT_SCENARIO,
      {
        includeCurves: true,
      },
    )
    const plain = recommend(
      DEFAULT_LAUNCH_CONFIG,
      GOAL_OBJECTIVES[LaunchGoal.FairLaunch],
      DEFAULT_SCENARIO,
    )
    expect(result?.flat.metrics.humanProfit).toBeCloseTo(
      plain?.flat.metrics.humanProfit ?? Number.NaN,
    )
  })

  it('every proposal compiles, whatever its curve', () => {
    const result = recommend(
      DEFAULT_LAUNCH_CONFIG,
      GOAL_OBJECTIVES[LaunchGoal.MaxRaise],
      SCENARIO_PRESETS[ScenarioPresetId.Hype],
      {
        includeCurves: true,
      },
    )
    expect(
      result?.proposals.every(
        (p) => compileLaunchConfig(p.candidate.config).ok,
      ),
    ).toBe(true)
  })

  it('stays fast enough for the browser', () => {
    const started = performance.now()
    recommend(
      DEFAULT_LAUNCH_CONFIG,
      GOAL_OBJECTIVES[LaunchGoal.FairLaunch],
      SCENARIO_PRESETS[ScenarioPresetId.Hype],
      {
        includeCurves: true,
      },
    )
    const ms = performance.now() - started
    console.log(`CURVE_SEARCH_MS ${Math.round(ms)}`)
    expect(ms).toBeLessThan(5000)
  })
})

describe('price-anchored search (tokenized stock listing)', () => {
  const stock = SCENARIO_PRESETS[ScenarioPresetId.StockListing]
  const started = performance.now()
  const result = recommend(
    DEFAULT_LAUNCH_CONFIG,
    GOAL_OBJECTIVES[LaunchGoal.FairPrice],
    stock,
    { includeCurves: true },
  )
  const ms = performance.now() - started

  it('proposes a curve opening near the outside price that leaves arbitrage less than the stock preset', () => {
    const best = result?.proposals[0]?.candidate
    expect(best?.curve?.curveShape).toBe(CurveShape.MarketCap)
    if (best?.curve?.curveShape !== CurveShape.MarketCap) return
    expect(best.curve.initialMarketCap).toBeGreaterThanOrEqual(
      stock.arbitrageurs.fairMarketCapSol * 0.75,
    )
    expect(best.metrics.graduationRate).toBe(1)
    const preset = LAUNCH_PRESETS.find(
      (p) => p.id === LaunchPresetId.StockListing,
    )
    if (!preset) throw new Error('No stock-listing preset')
    const presetRun = searchConfigs({
      base: preset.config,
      objective: GOAL_OBJECTIVES[LaunchGoal.FairPrice],
      scenario: stock,
      seeds: DEFAULT_SEARCH_SEEDS,
      space: { modes: [], startingFeeBps: [], windowSeconds: [] },
      curves: [],
    }).candidates[0]
    expect(best.metrics.arbitrageProfit).toBeLessThan(
      presetRun?.metrics.arbitrageProfit ?? 0,
    )
  })

  it('stays fast enough for the browser', () => {
    console.log(`ANCHORED_SEARCH_MS ${Math.round(ms)}`)
    expect(ms).toBeLessThan(5000)
  })
})
