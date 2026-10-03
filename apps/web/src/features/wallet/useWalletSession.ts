import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import { errorMessage, SolanaNetwork } from '../../core/shared'
import { connectWallet, listDeployWallets, onWalletsChanged } from '.'
import type { ConnectedWallet, DeployWallet } from '.'

/**
 * The wallet a screen signs with and the network it signs on. Switching network drops the
 * connection and any mainnet acknowledgement, so both are always given for the network shown.
 */
export const useWalletSession = () => {
  const network = ref<SolanaNetwork>(SolanaNetwork.Devnet)
  const mainnetAcknowledged = ref(false)
  const wallets = shallowRef<DeployWallet[]>(listDeployWallets())
  const connected = shallowRef<ConnectedWallet | null>(null)

  onScopeDispose(
    onWalletsChanged(() => {
      wallets.value = listDeployWallets()
    }),
  )
  watch(network, () => {
    mainnetAcknowledged.value = false
    connected.value = null
  })

  /** Connects for the current network; the reason when it could not, else null. */
  const connect = async (wallet: DeployWallet): Promise<string | null> => {
    try {
      connected.value = await connectWallet(wallet, network.value)
      return null
    } catch (cause) {
      return errorMessage(cause)
    }
  }

  return { network, mainnetAcknowledged, wallets, connected, connect }
}

export type WalletSession = ReturnType<typeof useWalletSession>
