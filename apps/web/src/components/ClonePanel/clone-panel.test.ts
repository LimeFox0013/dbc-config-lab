import { describe, expect, it } from 'vitest'
import { clonedParameters } from '../../core/config-clone'
import { compileLaunchConfig, LAUNCH_PRESETS } from '../../core/launch-config'
import { adjustmentsOf, bpsOf, formOf } from './utils'

const parametersOf = (id: string) => {
  const preset = LAUNCH_PRESETS.find((p) => p.id === id)
  const compiled = preset && compileLaunchConfig(preset.config)
  if (!compiled?.ok) throw new Error(`No compilable preset ${id}`)
  return compiled.parameters
}

describe('adjustmentsOf', () => {
  it('adjusts nothing while the form still shows the original', () => {
    LAUNCH_PRESETS.forEach((preset) => {
      const parameters = parametersOf(preset.id)
      expect(adjustmentsOf(parameters, formOf(parameters))).toEqual({})
      expect(clonedParameters(parameters, {})).toEqual({ ok: true, parameters })
    })
  })

  it('reports only the terms the user changed, fees converted to basis points', () => {
    const parameters = parametersOf('sniper-shield')
    const form = formOf(parameters)
    expect(
      adjustmentsOf(parameters, { ...form, endingFeePercent: 0.5 }),
    ).toEqual({
      feeSchedule: {
        startingFeeBps: Math.round(form.startingFeePercent * 100),
        endingFeeBps: 50,
        windowSeconds: form.windowSeconds,
      },
    })
    expect(
      adjustmentsOf(parameters, { ...form, creatorTradingFeePercentage: 25 }),
    ).toEqual({ creatorTradingFeePercentage: 25 })
  })

  it('keeps a fraction of a basis point, and an empty fee, from becoming a signed number', () => {
    const parameters = parametersOf('sniper-shield')
    const form = formOf(parameters)
    const fraction = adjustmentsOf(parameters, {
      ...form,
      endingFeePercent: 0.015,
    })
    expect(fraction.feeSchedule?.endingFeeBps).toBe(1.5)
    expect(clonedParameters(parameters, fraction).ok).toBe(false)
    // An emptied number field arrives as an empty string.
    expect(bpsOf('')).toBeNaN()
    expect(
      adjustmentsOf(parameters, { ...form, endingFeePercent: 0.07 }).feeSchedule
        ?.endingFeeBps,
    ).toBe(7)
  })
})
