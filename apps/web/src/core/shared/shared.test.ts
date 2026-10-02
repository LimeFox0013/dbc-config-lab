import { describe, expect, it } from 'vitest'
import { clamp, errorMessage, plainCopy } from '.'

describe('errorMessage', () => {
  it('reads an Error message and stringifies anything else', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage('plain')).toBe('plain')
  })
})

describe('clamp', () => {
  it('keeps values in range and maps non-numbers to the minimum', () => {
    expect(clamp(5, 0, 1)).toBe(1)
    expect(clamp(-1, 0, 1)).toBe(0)
    expect(clamp(0.4, 0, 1)).toBe(0.4)
    expect(clamp(Number.NaN, 2, 9)).toBe(2)
    expect(clamp(Number.POSITIVE_INFINITY, 2, 9)).toBe(2)
  })
})

describe('plainCopy', () => {
  it('copies deeply, so changing the copy leaves the original alone', () => {
    const original = { a: [1, 2], b: { c: 'x' } }
    const copy = plainCopy(original)
    copy.a.push(3)
    copy.b.c = 'y'
    expect(original).toEqual({ a: [1, 2], b: { c: 'x' } })
  })
})
