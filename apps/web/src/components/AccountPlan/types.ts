import type {
  AccountClient,
  AccountView,
} from '@dbc-config-lab/core/features/account'
import type {
  ConnectedWallet,
  DeployWallet,
} from '@dbc-config-lab/core/features/wallet'

export interface AccountPlanProps {
  client: AccountClient
  account: AccountView
  wallets: DeployWallet[]
  /** The wallet that pays; the page asks to connect one when there is none. */
  connected: ConnectedWallet | null
}
