import { describe, expect, it } from 'vitest'
import {
  compileLaunchConfig,
  DEFAULT_LAUNCH_CONFIG,
  LAUNCH_PRESETS,
  parseLaunchConfig,
  serializeLaunchConfig,
} from '.'

describe('compileLaunchConfig', () => {
  it('compiles the default config into on-chain parameters', () => {
    const compiled = compileLaunchConfig(DEFAULT_LAUNCH_CONFIG)
    expect(compiled.ok).toBe(true)
  })

  it('rejects an invalid combination with a reason', () => {
    const compiled = compileLaunchConfig({
      ...DEFAULT_LAUNCH_CONFIG,
      fee: { ...DEFAULT_LAUNCH_CONFIG.fee, creatorTradingFeePercentage: 150 },
    })
    expect(compiled).toMatchObject({ ok: false })
    expect(compiled.ok ? '' : compiled.reason).not.toBe('')
  })
})

describe('serialization', () => {
  it('round-trips a config through a plain document without loss', () => {
    expect(
      parseLaunchConfig(serializeLaunchConfig(DEFAULT_LAUNCH_CONFIG)),
    ).toEqual(DEFAULT_LAUNCH_CONFIG)
  })
})

describe('LAUNCH_PRESETS', () => {
  it.each(LAUNCH_PRESETS.map((preset) => [preset.id, preset]))(
    '%s compiles',
    (_, preset) => {
      expect(compileLaunchConfig(preset.config)).toMatchObject({ ok: true })
    },
  )

  it('has unique ids', () => {
    expect(new Set(LAUNCH_PRESETS.map((preset) => preset.id)).size).toBe(
      LAUNCH_PRESETS.length,
    )
  })
})
