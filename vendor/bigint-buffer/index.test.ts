import { describe, expect, it } from 'vitest'
import { toBigIntBE, toBigIntLE, toBufferBE, toBufferLE } from './index.js'

// A u64 token amount as Solana stores it (little-endian) — 1_000_000_000_000 = 0xE8D4A51000.
const AMOUNT = 1_000_000_000_000n
const AMOUNT_LE = Buffer.from('0010a5d4e8000000', 'hex')
const AMOUNT_BE = Buffer.from('000000e8d4a51000', 'hex')

describe('bigint-buffer stand-in', () => {
  it('reads little- and big-endian buffers', () => {
    expect(toBigIntLE(AMOUNT_LE)).toBe(AMOUNT)
    expect(toBigIntBE(AMOUNT_BE)).toBe(AMOUNT)
  })

  it('writes little- and big-endian buffers of the given width', () => {
    expect(toBufferLE(AMOUNT, 8).equals(AMOUNT_LE)).toBe(true)
    expect(toBufferBE(AMOUNT, 8).equals(AMOUNT_BE)).toBe(true)
  })

  it('reads an empty buffer as zero, the input the native binding mishandled', () => {
    expect(toBigIntLE(Buffer.alloc(0))).toBe(0n)
    expect(toBigIntBE(Buffer.alloc(0))).toBe(0n)
  })

  it('handles the u128 and u64 extremes', () => {
    const u128Max = 2n ** 128n - 1n
    expect(toBigIntLE(toBufferLE(u128Max, 16))).toBe(u128Max)
    expect(toBufferBE(0n, 8).equals(Buffer.alloc(8))).toBe(true)
  })

  it('truncates an oversized value exactly as the original does (leading hex digits kept)', () => {
    expect(toBufferBE(0x1_0000_0001n, 4).toString('hex')).toBe('10000000')
  })
})
