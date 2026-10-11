import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DrizzleDb } from '../db'
import { mockDb } from '../testing/mock-db'
import { UsageService } from './usage.service'
import { addressCaller } from './utils'

describe('UsageService', () => {
  const returning = vi.fn()
  const onConflictDoUpdate = vi.fn(() => ({ returning }))
  const values = vi.fn(() => ({ onConflictDoUpdate }))
  const db = { insert: vi.fn(() => ({ values })) }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env['CALLER_HASH_KEY'] = 'test-key'
  })
  afterEach(() => {
    delete process.env['CALLER_HASH_KEY']
  })

  it("adds to today's count for the caller and returns the new total", async () => {
    returning.mockResolvedValueOnce([{ calls: 7 }])
    const service = new UsageService(db as never as DrizzleDb)

    const total = await service.record(
      'addr:x',
      2,
      new Date('2026-10-04T12:00:00Z'),
    )

    expect(values).toHaveBeenCalledWith({
      caller: 'addr:x',
      day: '2026-10-04',
      calls: 2,
    })
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1)
    expect(total).toBe(7)
  })

  it('counts an account under its own id and an address under its keyed hash', () => {
    const service = new UsageService(mockDb())
    expect(service.callerForAccount('account-1')).toBe('acct:account-1')
    expect(service.callerForAddress('203.0.113.7')).toBe(
      addressCaller('203.0.113.7', 'test-key'),
    )
  })

  it('refuses to start without the key that hashes caller addresses', () => {
    delete process.env['CALLER_HASH_KEY']
    expect(() => new UsageService(db as never as DrizzleDb)).toThrow(
      'CALLER_HASH_KEY',
    )
  })
})
