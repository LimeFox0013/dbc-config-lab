import { computed, ref, shallowRef, watch } from 'vue'
import { connectionFor } from '../../core/config-deploy'
import type { PreparedTransaction } from '../../core/config-deploy'
import { errorMessage, SolanaNetwork } from '../../core/shared'
import { signAndSendPrepared } from '../wallet'
import type { WalletSessionRefs } from '../wallet'
import { DeployStep } from './constants'
import type { PreparationOutcome } from './types'
import { canPrepare } from './utils'

/**
 * The prepare → review → sign cycle every signing screen shares: one transaction at a time,
 * dry-run before the wallet is asked, dropped as soon as anything it was built from
 * changes — except while the wallet is already signing it, so what is being signed is
 * never hidden. A preparation that finishes after it was dropped is ignored.
 */
export const useSignedTransaction = <P extends PreparedTransaction>(
  session: WalletSessionRefs,
) => {
  const { network, connected, mainnetAcknowledged } = session
  const prepared = shallowRef<P | null>(null)
  const step = ref<DeployStep>(DeployStep.Idle)
  const error = ref<string | null>(null)
  const signature = ref<string | null>(null)
  /** Bumped whenever a preparation stops applying, so a late result is dropped. */
  let preparation = 0

  /** Inputs the transaction depends on stay fixed while it is prepared or signed. */
  const busy = computed(
    () =>
      step.value === DeployStep.Preparing || step.value === DeployStep.Signing,
  )
  const canSign = computed(
    () =>
      connected.value !== null &&
      canPrepare(network.value, mainnetAcknowledged.value),
  )

  const discard = (): void => {
    if (step.value === DeployStep.Signing) return
    preparation += 1
    prepared.value = null
    signature.value = null
    error.value = null
    step.value = DeployStep.Idle
  }
  watch([network, connected], discard)
  // Taking the mainnet acknowledgement back withdraws what was prepared under it.
  watch(mainnetAcknowledged, (acknowledged) => {
    if (!acknowledged && network.value === SolanaNetwork.Mainnet) discard()
  })

  const fail = (reason: string | null): void => {
    error.value = reason
    step.value = DeployStep.Failed
  }

  /**
   * Builds and dry-runs a transaction. Resolves true when this preparation's outcome was
   * applied, false when it was dropped because something changed meanwhile.
   */
  const runPreparation = async (
    build: () => Promise<PreparationOutcome<P>>,
  ): Promise<boolean> => {
    if (!canSign.value) return false
    const current = ++preparation
    prepared.value = null
    signature.value = null
    error.value = null
    step.value = DeployStep.Preparing
    try {
      const outcome = await build()
      if (current !== preparation) return false
      if (outcome.ok) {
        prepared.value = outcome.prepared
        step.value = DeployStep.Ready
      } else fail(outcome.reason)
    } catch (cause) {
      if (current !== preparation) return false
      fail(errorMessage(cause))
    }
    return true
  }

  const signAndSend = async (): Promise<void> => {
    const wallet = connected.value
    const transaction = prepared.value
    if (!wallet || !transaction || !canSign.value) return
    step.value = DeployStep.Signing
    try {
      signature.value = await signAndSendPrepared(
        connectionFor(network.value),
        wallet,
        transaction,
        network.value,
      )
      step.value = DeployStep.Done
    } catch (cause) {
      fail(errorMessage(cause))
    }
  }

  return {
    prepared,
    step,
    error,
    signature,
    busy,
    canSign,
    discard,
    fail,
    runPreparation,
    signAndSend,
  }
}
