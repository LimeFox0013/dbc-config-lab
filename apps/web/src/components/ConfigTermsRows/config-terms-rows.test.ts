import { describe, expect, it } from 'vitest'
import { durationParts } from './utils'

describe('durationParts', () => {
  it('uses the largest unit the duration fills', () => {
    expect(durationParts(2 * 365 * 86_400)).toEqual({
      value: 730,
      unit: 'days',
    })
    expect(durationParts(5_400)).toEqual({ value: 1.5, unit: 'hours' })
    expect(durationParts(90)).toEqual({ value: 1.5, unit: 'minutes' })
    expect(durationParts(0)).toEqual({ value: 0, unit: 'seconds' })
  })
})
