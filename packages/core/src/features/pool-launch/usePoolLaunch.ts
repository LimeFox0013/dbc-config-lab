import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { PublicKey } from '@solana/web3.js'
import { connectionFor } from '../../core/config-deploy'
import { metadataRejection, preparePoolLaunch } from '../../core/pool-launch'
import type { PreparedLaunch, TokenMetadata } from '../../core/pool-launch'
import { useSignedTransaction } from '../deployment'
import { loadOnChainConfig } from '../onchain-config'
import type { LoadRefusal } from '../onchain-config'
import type { WalletSessionRefs } from '../wallet'

/**
 * Launches a token on an existing config: reads the config from chain, quotes the
 * creator's first buy, prepares and dry-runs the transaction, then has the wallet sign.
 */
export const usePoolLaunch = (
  session: WalletSessionRefs,
  initialConfigAddress: Readonly<Ref<string>>,
  initial: { metadata?: TokenMetadata; firstBuy?: number } = {},
) => {
  const { network, connected } = session
  const configAddress = ref(initialConfigAddress.value)
  const metadata = ref<TokenMetadata>({
    ...(initial.metadata ?? { name: '', symbol: '', uri: '' }),
  })
  const firstBuy = ref(initial.firstBuy ?? 0)
  const transaction = useSignedTransaction<PreparedLaunch>(session)
  /** Why the config could not be read, as a code the screen words; null otherwise. */
  const loadRejection = ref<LoadRefusal | null>(null)

  watch(initialConfigAddress, (address) => {
    configAddress.value = address
  })
  watch(
    [configAddress, metadata, firstBuy, network, connected],
    () => {
      loadRejection.value = null
      transaction.discard()
    },
    { deep: true },
  )

  const rejection = computed(() => metadataRejection(metadata.value))

  const prepare = async (): Promise<void> => {
    const owner = connected.value?.owner
    if (!owner || rejection.value) return
    loadRejection.value = null
    let refusal: LoadRefusal | null = null
    const applied = await transaction.runPreparation(async () => {
      const connection = connectionFor(network.value)
      const loaded = await loadOnChainConfig(
        connection,
        network.value,
        configAddress.value,
      )
      if (!loaded.ok) {
        refusal = { rejection: loaded.rejection, detail: loaded.detail }
        return { ok: false, reason: null }
      }
      const result = await preparePoolLaunch(connection, {
        configAddress: new PublicKey(loaded.loaded.configAddress),
        parameters: loaded.loaded.parameters,
        quoteToken: loaded.loaded.quoteToken,
        network: network.value,
        owner,
        metadata: metadata.value,
        firstBuy: firstBuy.value,
      })
      return result.ok
        ? { ok: true, prepared: result.launch }
        : { ok: false, reason: result.reason }
    })
    if (applied) loadRejection.value = refusal
  }

  const prepareAllowed = computed(
    () =>
      transaction.canSign.value &&
      rejection.value === null &&
      configAddress.value.trim().length > 0,
  )

  return {
    configAddress,
    metadata,
    firstBuy,
    rejection,
    prepared: transaction.prepared,
    step: transaction.step,
    busy: transaction.busy,
    error: transaction.error,
    loadRejection,
    signature: transaction.signature,
    prepareAllowed,
    prepare,
    signAndSend: transaction.signAndSend,
  }
}
