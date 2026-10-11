import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, shallowRef } from 'vue'
import type { Ref } from 'vue'
import { SolanaNetwork } from '@dbc-config-lab/core/core/shared'
import type {
  ApiFailure,
  ApiResult,
} from '@dbc-config-lab/core/features/account'
import {
  LaunchPageStatus,
  useLaunchPage,
} from '@dbc-config-lab/core/features/launch-page'
import type { LaunchPageState } from '@dbc-config-lab/core/features/launch-page'
import type * as LaunchPageModule from '@dbc-config-lab/core/features/launch-page'
import { LoadRejection } from '@dbc-config-lab/core/features/onchain-config'
import type { DeployWallet } from '@dbc-config-lab/core/features/wallet'
import {
  deployWalletFixture,
  FAKE_ADDRESS,
  onChainConfigFixture,
} from '../testing'
import { useAccountRequest } from './useAccountRequest'
import { useRoutedLaunchPage } from './useRoutedLaunchPage'
import { useWalletConnect } from './useWalletConnect'

/** The route the composable reads; tests change it in place, as navigation would. */
const route: { params: Record<string, string>; query: Record<string, string> } =
  reactive({ params: { config: FAKE_ADDRESS }, query: {} })
vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock(
  '@dbc-config-lab/core/features/launch-page',
  async (importOriginal) => ({
    ...(await importOriginal<typeof LaunchPageModule>()),
    useLaunchPage: vi.fn(),
  }),
)

const REFUSAL: ApiFailure = { status: 400, message: 'Not on this plan.' }
const refused: ApiResult<string[]> = { ok: false, failure: REFUSAL }

/** A promise settled from the test, to look at state while a call is in flight. */
const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('useWalletConnect', () => {
  const wallet = deployWalletFixture()

  it('keeps why the wallet could not connect, and clears it once one does', async () => {
    const connectWallet = vi
      .fn<(wallet: DeployWallet) => Promise<string | null>>()
      .mockResolvedValueOnce('User rejected the request.')
      .mockResolvedValueOnce(null)
    const { connectError, connect } = useWalletConnect(connectWallet)
    expect(connectError.value).toBeNull()

    await connect(wallet)
    expect(connectWallet).toHaveBeenCalledWith(wallet)
    expect(connectError.value).toBe('User rejected the request.')

    await connect(wallet)
    expect(connectError.value).toBeNull()
  })
})

describe('useAccountRequest', () => {
  it('is working only while a change is sent, and returns what the service said', async () => {
    const { working, failure, send } = useAccountRequest()
    const reply = deferred<ApiResult<string>>()
    const sent = send(() => reply.promise)
    expect(working.value).toBe(true)

    reply.resolve({ ok: true, value: 'key-1' })
    expect(await sent).toEqual({ ok: true, value: 'key-1' })
    expect(working.value).toBe(false)
    expect(failure.value).toBeNull()
  })

  it('keeps a refusal to show, and drops it when the next change is sent', async () => {
    const { failure, send } = useAccountRequest()
    await send(() => Promise.resolve(refused))
    expect(failure.value).toEqual(REFUSAL)

    const reply = deferred<ApiResult<null>>()
    const sent = send(() => reply.promise)
    expect(failure.value).toBeNull()
    reply.resolve({ ok: true, value: null })
    await sent
  })

  it('keeps what a read returned, or its refusal without touching the list', () => {
    const { failure, keep } = useAccountRequest()
    const list: Ref<string[]> = shallowRef(['old'])

    keep({ ok: true, value: ['a', 'b'] }, list)
    expect(list.value).toEqual(['a', 'b'])
    expect(failure.value).toBeNull()

    keep(refused, list)
    expect(list.value).toEqual(['a', 'b'])
    expect(failure.value).toEqual(REFUSAL)
  })
})

describe('useRoutedLaunchPage', () => {
  const state = shallowRef<LaunchPageState>({
    status: LaunchPageStatus.Loading,
  })

  beforeEach(() => {
    state.value = { status: LaunchPageStatus.Loading }
    route.query = {}
    vi.mocked(useLaunchPage).mockReset().mockReturnValue({ state })
  })

  it('reads the config the route names, on mainnet unless the query says otherwise', () => {
    const { network } = useRoutedLaunchPage()
    const [networkArg, addressArg] =
      vi.mocked(useLaunchPage).mock.calls[0] ?? []
    expect(addressArg?.value).toBe(FAKE_ADDRESS)
    expect(networkArg?.value).toBe(SolanaNetwork.Mainnet)

    route.query = { network: SolanaNetwork.Devnet }
    expect(network.value).toBe(SolanaNetwork.Devnet)
  })

  it('is ready, with the fee schedule, only once the config has loaded', () => {
    const { ready, schedule } = useRoutedLaunchPage()
    expect(ready.value).toBeNull()
    expect(schedule.value).toBeNull()

    state.value = {
      status: LaunchPageStatus.Refused,
      rejection: LoadRejection.NotFound,
    }
    expect(ready.value).toBeNull()

    state.value = {
      status: LaunchPageStatus.Ready,
      config: onChainConfigFixture(),
      branding: null,
      royalty: null,
    }
    expect(ready.value?.config.configAddress).toBe(FAKE_ADDRESS)
    expect(schedule.value).not.toBeNull()
  })
})
