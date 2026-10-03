import type { ConnectedWallet, DeployWallet } from '../../features/wallet'
import type { WalletAcknowledgement } from './constants'

export interface WalletBarProps {
  wallets: DeployWallet[]
  connected: ConnectedWallet | null
  /** While something is being prepared or signed, network and wallet stay as they are. */
  disabled: boolean
  /** A page addressed to one network (a launch page) does not offer the other. */
  networkLocked?: boolean
  /** Which mainnet acknowledgement to ask for. */
  acknowledgement: WalletAcknowledgement
}
