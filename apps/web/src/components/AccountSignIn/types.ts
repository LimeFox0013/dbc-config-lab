import type { AccountClient } from '@dbc-config-lab/core/features/account'
import type {
  ConnectedWallet,
  DeployWallet,
} from '@dbc-config-lab/core/features/wallet'

export interface AccountSignInProps {
  client: AccountClient
  wallets: DeployWallet[]
  connected: ConnectedWallet | null
}
