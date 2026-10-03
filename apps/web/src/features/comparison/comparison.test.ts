import { describe, expect, it } from 'vitest'
import { DEFAULT_LAUNCH_CONFIG, LAUNCH_PRESETS } from '../../core/launch-config'
import { DEFAULT_SCENARIO, runScenario } from '../../core/sniper-scenario'
import { compileLaunchConfig } from '../../core/launch-config'
import {
  compareConfigs,
  formatSol,
  formatSolChange,
  presetEntry,
  pricePath,
  sanitizeScenario,
  SCENARIO_LIMITS,
} from '.'

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

describe('formatting', () => {
  it('signs changes but not plain amounts', () => {
    expect(formatSolChange(1.044)).toBe('+1.04')
    expect(formatSolChange(-4.756)).toBe('-4.76')
    expect(formatSol(0.613)).toBe('0.61')
  })
})

describe('pricePath', () => {
  it('starts at the opening price and follows every executed trade', () => {
    const compiled = compileLaunchConfig(DEFAULT_LAUNCH_CONFIG)
    if (!compiled.ok) throw new Error(compiled.reason)
    const { simulation } = runScenario(compiled.parameters, DEFAULT_SCENARIO)
    const path = pricePath(compiled.parameters, simulation)

    expect(path[0]).toEqual({ at: 0, multiple: 1 })
    expect(path).toHaveLength(simulation.outcomes.length + 1)
    // The first buy moves the price up from the opening price.
    expect(path[1]?.multiple).toBeGreaterThan(1)
  })
})
