import { describe, expect, it } from 'vitest'
import { DEFAULT_LAUNCH_CONFIG, LAUNCH_PRESETS } from '../../core/launch-config'
import { DEFAULT_SCENARIO, runScenario } from '../../core/sniper-scenario'
import { compileLaunchConfig } from '../../core/launch-config'
import {
  compareConfigs,
  presetEntry,
  pricePath,
  sanitizeScenario,
  SCENARIO_LIMITS,
} from '.'
import { QuoteToken } from '../../core/quote-token'

describe('compareConfigs', () => {
  it('returns one row per preset, in order', () => {
    const rows = compareConfigs(
      LAUNCH_PRESETS.map(presetEntry),
      DEFAULT_SCENARIO,
    )
    expect(rows.map((row) => row.entry.id)).toEqual(
      LAUNCH_PRESETS.map((p) => p.id),
    )
    expect(rows.every((row) => row.ok)).toBe(true)
  })

  it('simulates a dynamic-fee config, charging more than without it', () => {
    const dynamic = {
      id: 'dynamic',
      name: 'Dynamic',
      intent: 'test',
      config: {
        ...DEFAULT_LAUNCH_CONFIG,
        fee: { ...DEFAULT_LAUNCH_CONFIG.fee, dynamicFeeEnabled: true },
      },
    }
    const base = { ...dynamic, id: 'base', config: DEFAULT_LAUNCH_CONFIG }
    const [withFee, without] = compareConfigs(
      [presetEntry(dynamic), presetEntry(base)],
      DEFAULT_SCENARIO,
    )
    if (!withFee?.ok || !without?.ok)
      throw new Error('both configs should simulate')
    expect(withFee.metrics.humanFees).toBeGreaterThan(without.metrics.humanFees)
  })

  it('shows a refusal reason for an invalid config', () => {
    const invalid = {
      id: 'invalid',
      name: 'Invalid',
      intent: 'test',
      config: {
        ...DEFAULT_LAUNCH_CONFIG,
        fee: { ...DEFAULT_LAUNCH_CONFIG.fee, creatorTradingFeePercentage: 150 },
      },
    }
    const [row] = compareConfigs([presetEntry(invalid)], DEFAULT_SCENARIO)
    expect(row).toMatchObject({ ok: false })
  })
})

describe('sanitizeScenario', () => {
  it('clamps oversized, negative and non-numeric inputs', () => {
    const spec = sanitizeScenario({
      ...DEFAULT_SCENARIO,
      seed: Number.NaN,
      snipers: { ...DEFAULT_SCENARIO.snipers, count: 1e9 },
      humans: { ...DEFAULT_SCENARIO.humans, count: -5 },
    })
    expect(spec.seed).toBe(0)
    expect(spec.snipers.count).toBe(SCENARIO_LIMITS.maxTraders)
    expect(spec.humans.count).toBe(SCENARIO_LIMITS.minTraders)
  })
})

describe('pricePath', () => {
  it('starts at the opening price and follows every executed trade', () => {
    const compiled = compileLaunchConfig(DEFAULT_LAUNCH_CONFIG)
    if (!compiled.ok) throw new Error(compiled.reason)
    const { simulation } = runScenario(
      compiled.parameters,
      DEFAULT_SCENARIO,
      QuoteToken.Sol,
    )
    const path = pricePath(compiled.parameters, simulation)

    expect(path[0]).toEqual({ at: 0, multiple: 1 })
    expect(path).toHaveLength(simulation.outcomes.length + 1)
    // The first buy moves the price up from the opening price.
    expect(path[1]?.multiple).toBeGreaterThan(1)
  })
})

describe('sanitizeScenario arbitrage cap', () => {
  it('spreads arbitrage checks out instead of letting them freeze the page', () => {
    const spec = sanitizeScenario({
      ...DEFAULT_SCENARIO,
      arbitrageurs: {
        ...DEFAULT_SCENARIO.arbitrageurs,
        count: 500,
        checkEverySeconds: 1,
        untilSeconds: 86_400,
      },
    })
    const { count, untilSeconds, checkEverySeconds } = spec.arbitrageurs
    expect((count * untilSeconds) / checkEverySeconds).toBeLessThanOrEqual(
      SCENARIO_LIMITS.maxArbitrageChecks,
    )
  })
})
