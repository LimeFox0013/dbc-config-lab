import { watch } from 'vue'
import type { Ref } from 'vue'
import {
  connectionFor,
  prepareParametersDeployment,
} from '../../core/config-deploy'
import type { PreparedDeployment } from '../../core/config-deploy'
import { useWalletSession } from '../wallet'
import type { DeployWallet, WalletSession } from '../wallet'
import type { DeployTarget } from './types'
import { useSignedTransaction } from './useSignedTransaction'

/** Deploys the chosen config — a preset, an edit or a clone — from the connected wallet. */
export const useDeployment = (
  target: Ref<DeployTarget>,
  session: WalletSession = useWalletSession(),
) => {
  const { network, mainnetAcknowledged, wallets, connected } = session
  const transaction = useSignedTransaction<PreparedDeployment>(session)
  // A replaced config (a re-added clone, an edit) drops what was prepared for the old one.
  watch(target, transaction.discard)

  const connect = async (wallet: DeployWallet): Promise<void> => {
    const reason = await session.connect(wallet)
    if (reason) transaction.fail(reason)
  }

  const prepare = (): Promise<boolean> =>
    transaction.runPreparation(async () => {
      const { compiled } = target.value
      const owner = connected.value?.owner
      if (!compiled.ok) return { ok: false, reason: compiled.reason }
      if (!owner) return { ok: false, reason: null }
      const result = await prepareParametersDeployment(
        connectionFor(network.value),
        {
          parameters: compiled.parameters,
          quoteToken: compiled.quoteToken,
          network: network.value,
          owner,
          royalty: target.value.royalty,
        },
      )
      return result.ok
        ? { ok: true, prepared: result.deployment }
        : { ok: false, reason: result.reason }
    })

  return {
    busy: transaction.busy,
    network,
    mainnetAcknowledged,
    wallets,
    connected,
    prepared: transaction.prepared,
    step: transaction.step,
    error: transaction.error,
    signature: transaction.signature,
    prepareAllowed: transaction.canSign,
    connect,
    prepare,
    signAndSend: transaction.signAndSend,
  }
}
