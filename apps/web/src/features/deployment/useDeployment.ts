import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
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
  signAndSendDeployment,
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

  const stopWatchingWallets = onWalletsChanged(() => {
    wallets.value = listDeployWallets()
  })
  onBeforeUnmount(stopWatchingWallets)

  /** A prepared transaction is only valid for the exact preset, network and wallet it was built for. */
  const discardPreparation = () => {
    prepared.value = null
    signature.value = null
    error.value = null
    step.value = DeployStep.Idle
  }
  watch([preset, network, connected], discardPreparation)
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
    const result = await prepareDeployment(connectionFor(network.value), {
      config: preset.value.config,
      network: network.value,
      owner: connected.value.owner,
    })
    if (!result.ok) return fail(new Error(result.reason))
    prepared.value = result.deployment
    step.value = DeployStep.Ready
  }

  const signAndSend = async () => {
    if (!connected.value || !prepared.value) return
    step.value = DeployStep.Signing
    try {
      signature.value = await signAndSendDeployment(
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

  return {
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
