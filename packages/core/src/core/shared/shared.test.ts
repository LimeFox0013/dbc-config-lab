import BN from 'bn.js'
import { describe, expect, it, vi } from 'vitest'
import {
  bpsFromPercent,
  chunks,
  clamp,
  errorMessage,
  evenSample,
  formatAmount,
  formatCount,
  formatMultiple,
  formatPercentChange,
  formatShare,
  formatSol,
  formatSolChange,
  isEnumValue,
  isRecord,
  isSolanaNetwork,
  MAX_ADDRESS_LENGTH,
  mean,
  parseAddress,
  percentFromBps,
  plainCopy,
  quoteValueAtSqrtPrice,
  reasonOf,
  shortAddress,
  sleep,
  SolanaNetwork,
  wholeTokens,
} from '.'

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

describe('shortAddress', () => {
  it('keeps both ends of an address', () => {
    expect(shortAddress('DrkDGXgnMJDWht6qcEVgur9JMEzf7kuWJKtZhvV2Kt5D')).toBe(
      'DrkD…Kt5D',
    )
  })
})

describe('number formatting', () => {
  it('signs changes but not plain amounts', () => {
    expect(formatSolChange(1.044)).toBe('+1.04')
    expect(formatSolChange(-4.756)).toBe('-4.76')
    expect(formatSol(0.613)).toBe('0.61')
    expect(formatCount(21045)).toBe('21,045')
    expect(formatAmount(85.5432)).toBe('85.54')
    expect(formatMultiple(1.23456)).toBe('1.23')
  })

  it('shows shares as whole percents and signs percent changes', () => {
    expect(formatShare(0.354)).toBe('35%')
    expect(formatPercentChange(12.4)).toBe('+12%')
    expect(formatPercentChange(-3)).toBe('-3%')
    expect(formatPercentChange(0)).toBe('0%')
  })
})

describe('evenSample', () => {
  it('keeps everything up to the limit, then spreads evenly from the first item', () => {
    const items = Array.from({ length: 10 }, (_, i) => i)
    expect(evenSample(items, 20)).toEqual(items)
    expect(evenSample(items, 5)).toEqual([0, 2, 4, 6, 8])
  })
})

describe('chunks', () => {
  it('groups items in order, the last group holding the rest', () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunks([], 2)).toEqual([])
  })
})

describe('isRecord', () => {
  it('accepts plain objects only', () => {
    expect(isRecord({ a: 1 })).toBe(true)
    expect(isRecord([])).toBe(false)
    expect(isRecord(null)).toBe(false)
    expect(isRecord('text')).toBe(false)
  })
})

describe('isEnumValue', () => {
  enum Choice {
    Off = 0,
    On = 1,
  }
  const isChoice = isEnumValue<Choice>(Object.values(Choice))

  it('accepts the enum’s numeric members only', () => {
    expect(isChoice(Choice.On)).toBe(true)
    expect(isChoice(2)).toBe(false)
  })
})

describe('parseAddress', () => {
  it('reads a trimmed base58 address', () => {
    expect(
      parseAddress('  11111111111111111111111111111112 ')?.toBase58(),
    ).toBe('11111111111111111111111111111112')
  })

  it('refuses empty, overlong and non-address input', () => {
    expect(parseAddress('')).toBeNull()
    expect(parseAddress('1'.repeat(MAX_ADDRESS_LENGTH + 1))).toBeNull()
    expect(parseAddress('not an address')).toBeNull()
  })
})

describe('isSolanaNetwork', () => {
  it('accepts the networks’ own ids and nothing else', () => {
    expect(isSolanaNetwork(SolanaNetwork.Devnet)).toBe(true)
    expect(isSolanaNetwork('mainnet-beta')).toBe(true)
    expect(isSolanaNetwork('mainnet')).toBe(false)
    expect(isSolanaNetwork(null)).toBe(false)
  })
})

describe('reasonOf', () => {
  it('appends the detail when there is one', () => {
    expect(reasonOf({ rejection: 'not-found' })).toBe('not-found')
    expect(reasonOf({ rejection: 'network-error', detail: 'timeout' })).toBe(
      'network-error: timeout',
    )
  })
})

describe('sleep', () => {
  it('resolves once the time has passed, not before', async () => {
    vi.useFakeTimers()
    try {
      let done = false
      const waiting = sleep(1000).then(() => {
        done = true
      })
      await vi.advanceTimersByTimeAsync(999)
      expect(done).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await waiting
      expect(done).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('math', () => {
  it('converts between percent and basis points without float noise', () => {
    expect(percentFromBps(250)).toBe(2.5)
    expect(bpsFromPercent(0.07)).toBe(7)
    expect(bpsFromPercent(0.255)).toBe(25.5)
  })

  it('reads base units as whole tokens', () => {
    expect(wholeTokens(new BN(1_500_000), 6)).toBe(1.5)
  })

  it('values tokens at a Q64 sqrt price', () => {
    const oneQ64 = new BN(1).shln(64)
    expect(quoteValueAtSqrtPrice(new BN(7), oneQ64).toString()).toBe('7')
    expect(quoteValueAtSqrtPrice(new BN(7), oneQ64.muln(2)).toString()).toBe(
      '28',
    )
  })

  it('averages values, 0 for none', () => {
    expect(mean([1, 2, 6])).toBe(3)
    expect(mean([])).toBe(0)
  })
})
