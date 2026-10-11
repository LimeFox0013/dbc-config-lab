import { describe, expect, it } from 'vitest'
import { bearerKey, countToolCalls } from './utils'

describe('countToolCalls', () => {
  it('counts one tools/call message', () => {
    expect(
      countToolCalls({ jsonrpc: '2.0', id: 1, method: 'tools/call' }),
    ).toBe(1)
  })

  it('counts every tools/call in a batch and nothing else', () => {
    expect(
      countToolCalls([
        { method: 'tools/call' },
        { method: 'tools/list' },
        { method: 'tools/call' },
      ]),
    ).toBe(2)
  })

  it('counts nothing for non-tool traffic or a malformed body', () => {
    expect(countToolCalls({ method: 'initialize' })).toBe(0)
    expect(countToolCalls(undefined)).toBe(0)
    expect(countToolCalls('tools/call')).toBe(0)
  })
})

describe('bearerKey', () => {
  it('reads the key whatever the scheme name\'s case', () => {
    expect(bearerKey('Bearer lab_abc')).toBe('lab_abc')
    expect(bearerKey('bearer lab_abc')).toBe('lab_abc')
  })

  it('is undefined without a bearer header', () => {
    expect(bearerKey(undefined)).toBeUndefined()
    expect(bearerKey('Basic xyz')).toBeUndefined()
  })
})
