import type { DeployTarget } from '../../features/deployment'
import type { ConnectedWallet } from '../../features/wallet'
import type { SolanaNetwork } from '../../core/shared'

export interface DeployPanelProps {
  targets: DeployTarget[]
  /** Selected at first; a config from someone else's link should never be the default. */
  initialTargetId: DeployTarget['id']
}

export interface EarningsSectionProps {
  network: SolanaNetwork
  connected: ConnectedWallet | null
  mainnetAcknowledged: boolean
}

export interface BrandingSectionProps {
  network: SolanaNetwork
  connected: ConnectedWallet | null
  mainnetAcknowledged: boolean
  /** The config deployed in this session, whose launch page is offered; empty until one is. */
  configAddress: string
}
