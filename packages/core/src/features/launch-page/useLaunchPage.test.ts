import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import {
  DEFAULT_LAUNCH_CONFIG,
  compileLaunchConfig,
} from '../../core/launch-config'
import { QuoteToken } from '../../core/quote-token'
import { SolanaNetwork } from '../../core/shared'
import { LoadRejection } from '../onchain-config'
import { LaunchPageStatus } from './constants'
import { readLaunchPage } from './read'
import type { LaunchPageRead } from './types'
import { useLaunchPage } from './useLaunchPage'

vi.mock('./read', () => ({ readLaunchPage: vi.fn() }))

const compiled = compileLaunchConfig(DEFAULT_LAUNCH_CONFIG)
if (!compiled.ok) throw new Error(compiled.reason)

const ready = (configAddress: string): LaunchPageRead => ({
  status: LaunchPageStatus.Ready,
  config: {
    configAddress,
    network: SolanaNetwork.Devnet,
    feeClaimer: configAddress,
    parameters: compiled.parameters,
    quoteToken: QuoteToken.Sol,
  },
  branding: null,
  royalty: null,
})

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  vi.mocked(readLaunchPage).mockReset()
})

describe('useLaunchPage', () => {
  it('loads at once, then shows what the read gave', async () => {
    vi.mocked(readLaunchPage).mockResolvedValue(ready('Cfg1'))
    const scope = effectScope()
    const page = scope.run(() =>
      useLaunchPage(ref(SolanaNetwork.Devnet), ref('Cfg1')),
    )
    if (!page) throw new Error('scope did not run')

    expect(page.state.value.status).toBe(LaunchPageStatus.Loading)
    await settle()
    expect(page.state.value).toEqual(ready('Cfg1'))
    expect(readLaunchPage).toHaveBeenCalledWith(
      expect.anything(),
      SolanaNetwork.Devnet,
      'Cfg1',
    )
    scope.stop()
  })

  it('drops an answer for an address the page has moved on from', async () => {
    let answerFirst: (read: LaunchPageRead) => void = () => undefined
    vi.mocked(readLaunchPage)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answerFirst = resolve
          }),
      )
      .mockResolvedValueOnce({
        status: LaunchPageStatus.Refused,
        rejection: LoadRejection.NotFound,
      })
    const address = ref('Cfg1')
    const scope = effectScope()
    const page = scope.run(() =>
      useLaunchPage(ref(SolanaNetwork.Devnet), address),
    )
    if (!page) throw new Error('scope did not run')

    address.value = 'Cfg2'
    await settle()
    answerFirst(ready('Cfg1'))
    await settle()

    expect(page.state.value).toEqual({
      status: LaunchPageStatus.Refused,
      rejection: LoadRejection.NotFound,
    })
    scope.stop()
  })
})
