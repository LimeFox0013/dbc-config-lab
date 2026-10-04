import type { ConnectedWallet } from '../../features/wallet'
import type { SolanaNetwork } from '../../core/shared'

export interface EarningsSectionProps {
  network: SolanaNetwork
  connected: ConnectedWallet | null
  mainnetAcknowledged: boolean
}
