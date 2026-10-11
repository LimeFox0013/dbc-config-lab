import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import {
  compileLaunchConfig,
  DEFAULT_LAUNCH_CONFIG,
} from '../../core/launch-config'
import { QuoteToken } from '../../core/quote-token'
import { SolanaNetwork } from '../../core/shared'
import type * as OnChainConfigModule from '../onchain-config'
import { loadOnChainConfig, LoadRejection } from '../onchain-config'
import { CloneStatus } from './constants'
import type { CloneSource } from './types'
import { useHandoffClone } from './useHandoffClone'

vi.mock('../onchain-config', async (importOriginal) => ({
  ...(await importOriginal<typeof OnChainConfigModule>()),
  loadOnChainConfig: vi.fn(),
}))

const SOURCE = 'Z4EsKJjpBuxKqbRNzxeWbj7PsaNcp2vjZpAHWu86Wkn'
const compiled = compileLaunchConfig(DEFAULT_LAUNCH_CONFIG)
if (!compiled.ok) throw new Error(compiled.reason)

const source = (adjustments: CloneSource['adjustments']): CloneSource => ({
  sourceAddress: SOURCE,
  sourceNetwork: SolanaNetwork.Mainnet,
  adjustments,
})
const label = () => ({ name: 'Clone', intent: 'Proposed by an agent' })
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  vi.mocked(loadOnChainConfig).mockReset()
})

describe('useHandoffClone', () => {
  it('builds the clone from the original read from chain', async () => {
    vi.mocked(loadOnChainConfig).mockResolvedValue({
      ok: true,
      loaded: {
        configAddress: SOURCE,
        network: SolanaNetwork.Mainnet,
        feeClaimer: SOURCE,
        parameters: compiled.parameters,
        quoteToken: QuoteToken.Sol,
      },
    })
    const scope = effectScope()
    const state = scope.run(() =>
      useHandoffClone(ref(source({ creatorTradingFeePercentage: 10 })), label),
    )
    if (!state) throw new Error('scope did not run')

    expect(state.value.status).toBe(CloneStatus.Loading)
    await settle()
    expect(state.value).toMatchObject({
      status: CloneStatus.Ready,
      target: { name: 'Clone', compiled: { ok: true } },
    })
    expect(loadOnChainConfig).toHaveBeenCalledWith(
      expect.anything(),
      SolanaNetwork.Mainnet,
      SOURCE,
    )
    scope.stop()
  })

  it('refuses with the reason the original could not be read', async () => {
    vi.mocked(loadOnChainConfig).mockResolvedValue({
      ok: false,
      rejection: LoadRejection.NetworkError,
      detail: 'timeout',
    })
    const scope = effectScope()
    const state = scope.run(() => useHandoffClone(ref(source({})), label))
    if (!state) throw new Error('scope did not run')

    await settle()
    expect(state.value).toEqual({
      status: CloneStatus.Refused,
      reason: `${LoadRejection.NetworkError}: timeout`,
    })
    scope.stop()
  })

  it('stays loading without a proposed clone', async () => {
    const scope = effectScope()
    const state = scope.run(() => useHandoffClone(ref(null), label))
    if (!state) throw new Error('scope did not run')
    await settle()
    expect(state.value).toEqual({ status: CloneStatus.Loading })
    expect(loadOnChainConfig).not.toHaveBeenCalled()
    scope.stop()
  })
})
