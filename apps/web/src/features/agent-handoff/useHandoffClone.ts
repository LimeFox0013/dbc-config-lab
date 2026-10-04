import { shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import { connectionFor } from '../../core/config-deploy'
import type { DeployTarget } from '../deployment'
import { loadOnChainConfig } from '../onchain-config'
import { CloneStatus } from './constants'
import type { CloneSource, HandoffCloneState } from './types'
import { handoffCloneTarget } from './utils'

/**
 * Reads a proposed clone's original from chain and applies the proposed adjustments, so
 * the clone shown for signing is built here from the chain, not taken from the link.
 */
export const useHandoffClone = (
  source: Readonly<Ref<CloneSource | null>>,
  label: (configAddress: string) => Pick<DeployTarget, 'name' | 'intent'>,
) => {
  const state = shallowRef<HandoffCloneState>({ status: CloneStatus.Loading })
  /** Bumped per read, so an answer for an earlier link is dropped. */
  let read = 0

  watch(
    source,
    async (current) => {
      const token = ++read
      state.value = { status: CloneStatus.Loading }
      if (!current) return
      const loaded = await loadOnChainConfig(
        connectionFor(current.sourceNetwork),
        current.sourceNetwork,
        current.sourceAddress,
      )
      if (token !== read) return
      if (!loaded.ok) {
        state.value = {
          status: CloneStatus.Refused,
          reason: loaded.detail
            ? `${loaded.rejection}: ${loaded.detail}`
            : loaded.rejection,
        }
        return
      }
      const clone = handoffCloneTarget(
        loaded.loaded,
        current.adjustments,
        label(loaded.loaded.configAddress),
      )
      state.value = clone.ok
        ? { status: CloneStatus.Ready, target: clone.target }
        : { status: CloneStatus.Refused, reason: clone.reason }
    },
    { immediate: true },
  )

  return state
}
