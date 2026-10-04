import type { DeployTarget } from '../../features/deployment'
import type { ConnectedWallet } from '../../features/wallet'
import type { SolanaNetwork } from '../../core/shared'

export interface ConfigDeployProps {
  target: DeployTarget
  network: SolanaNetwork
  connected: ConnectedWallet | null
  mainnetAcknowledged: boolean
}
