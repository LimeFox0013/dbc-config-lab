import { shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import { connectionFor } from '../../core/config-deploy'
import type { SolanaNetwork } from '../../core/shared'
import { LaunchPageStatus } from './constants'
import { readLaunchPage } from './read'
import type { LaunchPageState } from './types'

/** Reads the page's config and its operator's branding from chain, again whenever either address changes. */
export const useLaunchPage = (
  network: Readonly<Ref<SolanaNetwork>>,
  configAddress: Readonly<Ref<string>>,
) => {
  const state = shallowRef<LaunchPageState>({
    status: LaunchPageStatus.Loading,
  })
  let lookup = 0

  watch(
    [network, configAddress],
    async ([current, address]) => {
      const read = ++lookup
      state.value = { status: LaunchPageStatus.Loading }
      const result = await readLaunchPage(
        connectionFor(current),
        current,
        address,
      )
      if (read === lookup) state.value = result
    },
    { immediate: true },
  )

  return { state }
}
