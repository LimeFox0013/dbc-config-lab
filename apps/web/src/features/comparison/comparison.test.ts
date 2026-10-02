import { describe, expect, it } from 'vitest'
import { DEFAULT_LAUNCH_CONFIG, LAUNCH_PRESETS } from '../../core/launch-config'
import { DEFAULT_SCENARIO } from '../../core/sniper-scenario'
import {
  compareConfigs,
  formatSol,
  formatSolChange,
  presetEntry,
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

  it('shows a refusal reason instead of numbers for an unsupported config', () => {
    const dynamic = {
      id: 'dynamic',
      name: 'Dynamic',
      intent: 'test',
      config: {
        ...DEFAULT_LAUNCH_CONFIG,
        fee: { ...DEFAULT_LAUNCH_CONFIG.fee, dynamicFeeEnabled: true },
      },
    }
    const [row] = compareConfigs([presetEntry(dynamic)], DEFAULT_SCENARIO)
    expect(row).toMatchObject({ ok: false })
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
