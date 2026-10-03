import { shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import { COMMITMENT, connectionFor } from '../../core/config-deploy'
import { readPartnerBranding } from '../../core/partner-branding'
import { loadOnChainConfig } from '../onchain-config'
import { LaunchPageStatus } from './constants'
import type { LaunchPageState } from './types'
import type { SolanaNetwork } from '../../core/shared'

/** Reads the page's config and its operator's branding from chain, again whenever either address changes. */
import { readRoyaltySplit } from '../../core/preset-royalty'
import { PublicKey } from '@solana/web3.js'
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
      // A launch page never fails for want of branding or a royalty split: both are extras.
      const royalty = await readRoyaltySplit(
        connection,
        new PublicKey(result.loaded.feeClaimer),
        COMMITMENT,
      ).catch(() => null)
      // A royalty vault cannot publish branding; its operator's wallet can.
      const branding = await readPartnerBranding(
        connection,
        royalty?.deployer ?? result.loaded.feeClaimer,
      ).catch(() => null)
      if (read !== lookup) return
      state.value = {
        status: LaunchPageStatus.Ready,
        config: result.loaded,
        branding,
        royalty,
      }
    },
    { immediate: true },
  )

  return { state }
}
