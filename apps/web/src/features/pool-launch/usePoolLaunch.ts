import { computed, ref, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import { PublicKey } from '@solana/web3.js'
import { connectionFor } from '../../core/config-deploy'
import type { SolanaNetwork } from '../../core/config-deploy'
import { metadataRejection, preparePoolLaunch } from '../../core/pool-launch'
import type { PreparedLaunch, TokenMetadata } from '../../core/pool-launch'
import { errorMessage } from '../../core/shared'
import { canPrepare, DeployStep } from '../deployment'
import { loadOnChainConfig } from '../onchain-config'
import { signAndSendPrepared } from '../wallet'
import type { ConnectedWallet } from '../wallet'

/** The wallet session the launch shares with config deployment. */
export interface LaunchSession {
  network: Readonly<Ref<SolanaNetwork>>
  connected: Readonly<Ref<ConnectedWallet | null>>
  mainnetAcknowledged: Readonly<Ref<boolean>>
}

/**
 * Launches a token on an existing config: reads the config from chain, quotes the
 * creator's first buy, prepares and dry-runs the transaction, then has the wallet sign.
 */
export const usePoolLaunch = (
  session: LaunchSession,
  initialConfigAddress: Readonly<Ref<string>>,
) => {
  const { network, connected, mainnetAcknowledged } = session
  const configAddress = ref(initialConfigAddress.value)
  const metadata = ref<TokenMetadata>({ name: '', symbol: '', uri: '' })
  const firstBuy = ref(0)
  const prepared = shallowRef<PreparedLaunch | null>(null)
  const step = ref<DeployStep>(DeployStep.Idle)
  const error = ref<string | null>(null)
  const signature = ref<string | null>(null)
  /** Bumped whenever a preparation stops being valid, so a late result is dropped. */
  let preparation = 0

  watch(initialConfigAddress, (address) => {
    configAddress.value = address
  })

  const discardPreparation = () => {
    preparation += 1
    prepared.value = null
    signature.value = null
    error.value = null
    step.value = DeployStep.Idle
  }
  watch(
    [configAddress, metadata, firstBuy, network, connected],
    discardPreparation,
    { deep: true },
  )
  watch(mainnetAcknowledged, (acknowledged) => {
    if (!acknowledged) discardPreparation()
  })

  const fail = (reason: string) => {
    error.value = reason
    step.value = DeployStep.Failed
  }

  const rejection = computed(() => metadataRejection(metadata.value))

  const prepare = async () => {
    const wallet = connected.value
    if (
      !wallet ||
      rejection.value ||
      !canPrepare(network.value, mainnetAcknowledged.value)
    )
      return
    step.value = DeployStep.Preparing
    error.value = null
    const attempt = ++preparation
    const connection = connectionFor(network.value)
    try {
      const loaded = await loadOnChainConfig(
        connection,
        network.value,
        configAddress.value,
      )
      if (attempt !== preparation) return
      if (!loaded.ok)
        return fail(
          `${loaded.rejection}${loaded.detail ? `: ${loaded.detail}` : ''}`,
        )
      const result = await preparePoolLaunch(connection, {
        configAddress: new PublicKey(loaded.loaded.configAddress),
        parameters: loaded.loaded.parameters,
        quoteToken: loaded.loaded.quoteToken,
        network: network.value,
        owner: wallet.owner,
        metadata: metadata.value,
        firstBuy: firstBuy.value,
      })
      // The inputs changed while this was running: it no longer applies.
      if (attempt !== preparation) return
      if (!result.ok) return fail(result.reason)
      prepared.value = result.launch
      step.value = DeployStep.Ready
    } catch (cause) {
      if (attempt === preparation) fail(errorMessage(cause))
    }
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
      fail(errorMessage(cause))
    }
  }

  const prepareAllowed = computed(
    () =>
      connected.value !== null &&
      rejection.value === null &&
      configAddress.value.trim().length > 0 &&
      canPrepare(network.value, mainnetAcknowledged.value),
  )

  return {
    configAddress,
    metadata,
    firstBuy,
    rejection,
    prepared,
    step,
    error,
    signature,
    prepareAllowed,
    prepare,
    signAndSend,
  }
}
