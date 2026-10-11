// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuoteToken } from '@dbc-config-lab/core/core/quote-token'
import { SolanaNetwork } from '@dbc-config-lab/core/core/shared'
import { fetchRealLaunches } from '@dbc-config-lab/core/features/real-launches'
import type * as RealLaunchesModule from '@dbc-config-lab/core/features/real-launches'
import { FAKE_ADDRESS, onChainConfigFixture } from '../testing'
import {
  labelById,
  launchpadTermsValues,
  numberFromEvent,
  onChainKey,
  prependReplacing,
  readRealLaunches,
  selectedValue,
} from './utils'

vi.mock(
  '@dbc-config-lab/core/features/real-launches',
  async (importOriginal) => ({
    ...(await importOriginal<typeof RealLaunchesModule>()),
    fetchRealLaunches: vi.fn(),
  }),
)

/** An event dispatched from `element`, so its target is set as in the browser. */
const eventFrom = (element: Element): Event => {
  const event = new Event('change')
  element.dispatchEvent(event)
  return event
}

describe('onChainKey', () => {
  it('tells the same address on two networks apart', () => {
    expect(
      onChainKey({ network: SolanaNetwork.Devnet, configAddress: 'abc' }),
    ).toBe(`${SolanaNetwork.Devnet}:abc`)
    expect(
      onChainKey({ network: SolanaNetwork.Devnet, configAddress: 'abc' }),
    ).not.toBe(
      onChainKey({ network: SolanaNetwork.Mainnet, configAddress: 'abc' }),
    )
  })
})

describe('prependReplacing', () => {
  const byId = (item: { id: string }): string => item.id

  it('puts a new item first', () => {
    expect(prependReplacing([{ id: 'a' }], { id: 'b' }, byId)).toEqual([
      { id: 'b' },
      { id: 'a' },
    ])
  })

  it('replaces an earlier item with the same key, moving it first', () => {
    const list = [
      { id: 'a', v: 1 },
      { id: 'b', v: 1 },
    ]
    expect(prependReplacing(list, { id: 'b', v: 2 }, byId)).toEqual([
      { id: 'b', v: 2 },
      { id: 'a', v: 1 },
    ])
    expect(list).toHaveLength(2)
  })
})

describe('labelById', () => {
  const items = [{ id: 'w1', target: 'Addr1' }]

  it('gives the listed item’s label', () => {
    expect(labelById(items, 'w1', (item) => item.target)).toBe('Addr1')
  })

  it('falls back to the id once the item is gone', () => {
    expect(labelById(items, 'w2', (item) => item.target)).toBe('w2')
  })
})

describe('launchpadTermsValues', () => {
  it('states the threshold in whole quote tokens, its symbol and the creator share', () => {
    const config = onChainConfigFixture()
    expect(launchpadTermsValues(config)).toEqual({
      threshold: '85',
      symbol: 'SOL',
      creator: config.parameters.creatorTradingFeePercentage,
    })
  })
})

describe('readRealLaunches', () => {
  beforeEach(() => vi.mocked(fetchRealLaunches).mockReset())

  it('reads the config’s pools on its own network, priced in its quote token', async () => {
    const config = onChainConfigFixture()
    await readRealLaunches(config)
    const [connection, address, parameters, quote] =
      vi.mocked(fetchRealLaunches).mock.calls[0] ?? []
    expect(connection?.rpcEndpoint).toContain('/rpc/mainnet')
    expect(address).toBe(FAKE_ADDRESS)
    expect(parameters).toBe(config.parameters)
    expect(quote).toBe(QuoteToken.Sol)
  })
})

describe('numberFromEvent', () => {
  it('reads a number input as a number, and an emptied one as not a number', () => {
    const input = document.createElement('input')
    input.type = 'number'
    input.value = '12.5'
    expect(numberFromEvent(eventFrom(input))).toBe(12.5)
    input.value = ''
    expect(numberFromEvent(eventFrom(input))).toBeNaN()
  })

  it('reads a select’s value as a number', () => {
    const select = document.createElement('select')
    select.append(new Option('two', '2'))
    expect(numberFromEvent(eventFrom(select))).toBe(2)
  })

  it('is not a number for any other element', () => {
    expect(numberFromEvent(eventFrom(document.createElement('div')))).toBeNaN()
  })
})

describe('selectedValue', () => {
  it('gives a select’s value, and null for anything else', () => {
    const select = document.createElement('select')
    select.append(new Option('Typical', 'typical'))
    expect(selectedValue(eventFrom(select))).toBe('typical')
    expect(selectedValue(eventFrom(document.createElement('input')))).toBeNull()
  })
})
