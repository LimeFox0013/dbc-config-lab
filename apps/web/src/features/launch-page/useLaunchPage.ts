import { shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import { connectionFor } from '../../core/config-deploy'
import { readPartnerBranding } from '../../core/partner-branding'
import { loadOnChainConfig } from '../onchain-config'
import { LaunchPageStatus } from './constants'
import type { LaunchPageState } from './types'
import type { SolanaNetwork } from '../../core/shared'

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
      const connection = connectionFor(current)
      const result = await loadOnChainConfig(connection, current, address)
      if (read !== lookup) return
      if (!result.ok) {
        state.value = {
          status: LaunchPageStatus.Refused,
          rejection: result.rejection,
          detail: result.detail,
        }
        return
      }
      // A launch page never fails for want of branding: unbranded is the fallback.
      const branding = await readPartnerBranding(
        connection,
        result.loaded.feeClaimer,
      ).catch(() => null)
      if (read !== lookup) return
      state.value = {
        status: LaunchPageStatus.Ready,
        config: result.loaded,
        branding,
      }
    },
    { immediate: true },
  )

  return { state }
}
