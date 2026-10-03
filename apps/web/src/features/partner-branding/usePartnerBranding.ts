import { computed, ref, shallowRef, watch } from 'vue'
import { connectionFor } from '../../core/config-deploy'
import type { PreparedTransaction } from '../../core/config-deploy'
import {
  brandingRejection,
  preparePartnerBranding,
  readPartnerBranding,
} from '../../core/partner-branding'
import type { PartnerBranding } from '../../core/partner-branding'
import { errorMessage } from '../../core/shared'
import { DeployStep, useSignedTransaction } from '../deployment'
import type { WalletSessionRefs } from '../wallet'

/**
 * Publishes the connected wallet's launchpad branding. The program keeps one branding
 * account per fee-claiming wallet and creates it once, so what is already on chain is
 * read first and shown instead of the form.
 */
export const usePartnerBranding = (session: WalletSessionRefs) => {
  const { network, connected } = session
  /** Undefined while being read; null when the wallet has published none. */
  const published = shallowRef<PartnerBranding | null | undefined>(undefined)
  const branding = ref<PartnerBranding>({ name: '', website: '', logo: '' })
  const transaction = useSignedTransaction<PreparedTransaction>(session)
  const readError = ref<string | null>(null)
  watch(branding, transaction.discard, { deep: true })

  const readPublished = async (): Promise<void> => {
    const wallet = connected.value
    published.value = undefined
    readError.value = null
    if (!wallet) return
    const current = network.value
    try {
      const found = await readPartnerBranding(
        connectionFor(current),
        wallet.owner.toBase58(),
      )
      // The wallet or network changed while reading: that answer belongs to neither.
      if (connected.value === wallet && network.value === current)
        published.value = found
    } catch (cause) {
      readError.value = errorMessage(cause)
    }
  }
  watch([network, connected], readPublished, { immediate: true })

  const rejection = computed(() => brandingRejection(branding.value))

  const prepare = async (): Promise<void> => {
    const owner = connected.value?.owner
    if (!owner || rejection.value) return
    await transaction.runPreparation(() =>
      preparePartnerBranding(connectionFor(network.value), {
        branding: branding.value,
        owner,
      }),
    )
  }

  /** Signs, then reads the branding back so the screen shows what is now on chain. */
  const signAndSend = async (): Promise<void> => {
    await transaction.signAndSend()
    if (transaction.step.value === DeployStep.Done) await readPublished()
  }

  const prepareAllowed = computed(
    () => transaction.canSign.value && rejection.value === null,
  )

  return {
    published,
    branding,
    rejection,
    prepared: transaction.prepared,
    step: transaction.step,
    busy: transaction.busy,
    error: computed(() => transaction.error.value ?? readError.value),
    signature: transaction.signature,
    prepareAllowed,
    prepare,
    signAndSend,
  }
}
