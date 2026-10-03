import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import {
  connectionFor,
  prepareDeployment,
  SolanaNetwork,
} from '../../core/config-deploy'
import type { PreparedDeployment } from '../../core/config-deploy'
import type { LaunchPreset } from '../../core/launch-config'
import {
  connectWallet,
  listDeployWallets,
  onWalletsChanged,
  signAndSendPrepared,
} from '../wallet'
import type { ConnectedWallet, DeployWallet } from '../wallet'
import { DeployStep } from './constants'
import { errorMessage } from '../../core/shared'
import { canPrepare } from './utils'

export const useDeployment = (preset: Ref<LaunchPreset>) => {
  const network = ref<SolanaNetwork>(SolanaNetwork.Devnet)
  const mainnetAcknowledged = ref(false)
  const wallets = shallowRef<DeployWallet[]>(listDeployWallets())
  const connected = shallowRef<ConnectedWallet | null>(null)
  const prepared = shallowRef<PreparedDeployment | null>(null)
  const step = ref<DeployStep>(DeployStep.Idle)
  const error = ref<string | null>(null)
  const signature = ref<string | null>(null)
  /** Bumped whenever a preparation stops being valid, so a late result is dropped. */
  let preparation = 0

  const stopWatchingWallets = onWalletsChanged(() => {
    wallets.value = listDeployWallets()
  })
  onScopeDispose(stopWatchingWallets)

  /** A prepared transaction is only valid for the exact preset, network and wallet it was built for. */
  const discardPreparation = () => {
    preparation += 1
    prepared.value = null
    signature.value = null
    error.value = null
    step.value = DeployStep.Idle
  }
  watch([preset, network, connected], discardPreparation)
  watch(mainnetAcknowledged, (acknowledged) => {
    if (!acknowledged && network.value === SolanaNetwork.Mainnet)
      discardPreparation()
  })
  watch(network, () => {
    mainnetAcknowledged.value = false
    connected.value = null
  })

  const fail = (cause: unknown) => {
    error.value = errorMessage(cause)
    step.value = DeployStep.Failed
  }

  const connect = async (wallet: DeployWallet) => {
    try {
      connected.value = await connectWallet(wallet, network.value)
    } catch (cause) {
      fail(cause)
    }
  }

  const prepare = async () => {
    if (
      !connected.value ||
      !canPrepare(network.value, mainnetAcknowledged.value)
    )
      return
    step.value = DeployStep.Preparing
    error.value = null
    const attempt = ++preparation
    const result = await prepareDeployment(connectionFor(network.value), {
      config: preset.value.config,
      network: network.value,
      owner: connected.value.owner,
    })
    // The preset, network or wallet changed while this was running: it no longer applies.
    if (attempt !== preparation) return
    if (!result.ok) return fail(new Error(result.reason))
    prepared.value = result.deployment
    step.value = DeployStep.Ready
  }

  const signAndSend = async () => {
    if (
      !connected.value ||
      !prepared.value ||
      !canPrepare(network.value, mainnetAcknowledged.value)
    )
      return
    step.value = DeployStep.Signing
    try {
      signature.value = await signAndSendPrepared(
        connectionFor(network.value),
        connected.value,
        prepared.value,
        network.value,
      )
      step.value = DeployStep.Done
    } catch (cause) {
      fail(cause)
    }
  }

  const prepareAllowed = computed(
    () =>
      connected.value !== null &&
      canPrepare(network.value, mainnetAcknowledged.value),
  )

  /** Inputs that the prepared transaction depends on stay fixed until it is sent or dropped. */
  const inputsLocked = computed(
    () =>
      step.value === DeployStep.Preparing || step.value === DeployStep.Signing,
  )

  return {
    inputsLocked,
    network,
    mainnetAcknowledged,
    wallets,
    connected,
    prepared,
    step,
    error,
    signature,
    prepareAllowed,
    connect,
    prepare,
    signAndSend,
  }
}
