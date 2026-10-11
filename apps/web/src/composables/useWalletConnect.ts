import { ref } from 'vue'
import type {
  DeployWallet,
  WalletSession,
} from '@dbc-config-lab/core/features/wallet'

/** Connects a wallet through a session and keeps why the last attempt failed, if it did. */
export const useWalletConnect = (connectWallet: WalletSession['connect']) => {
  const connectError = ref<string | null>(null)
  const connect = async (wallet: DeployWallet): Promise<void> => {
    connectError.value = await connectWallet(wallet)
  }
  return { connectError, connect }
}
