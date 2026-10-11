import type {
  ConnectedWallet,
  DeployWallet,
} from '@dbc-config-lab/core/features/wallet'

export interface WalletPickerProps {
  wallets: DeployWallet[]
  connected: ConnectedWallet | null
  /** While something is being prepared or signed, the wallet stays as it is. */
  disabled: boolean
  /** What to say when no wallet is installed — it names what the wallet is for. */
  noWalletText: string
}
