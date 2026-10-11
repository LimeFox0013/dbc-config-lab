import { describe, expect, it } from 'vitest'
import { addressCaller, utcDay } from './utils'

describe('usage utils', () => {
  it('dates a moment by its UTC day', () => {
    expect(utcDay(new Date('2026-10-04T23:59:59-02:00'))).toBe('2026-10-05')
  })

  it('identifies an address by a keyed hash that never contains it', () => {
    const caller = addressCaller('203.0.113.7', 'key-a')
    expect(caller).toMatch(/^addr:[0-9a-f]{64}$/)
    expect(caller).not.toContain('203.0.113.7')
    expect(addressCaller('203.0.113.7', 'key-a')).toBe(caller)
    expect(addressCaller('203.0.113.7', 'key-b')).not.toBe(caller)
  })
})
