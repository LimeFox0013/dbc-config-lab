import type { ConnectedWallet } from '@dbc-config-lab/core/features/wallet'
import type { SolanaNetwork } from '@dbc-config-lab/core/core/shared'

export interface EarningsSectionProps {
  network: SolanaNetwork
  connected: ConnectedWallet | null
  mainnetAcknowledged: boolean
}
