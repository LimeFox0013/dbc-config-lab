import type { DeployTarget } from '@dbc-config-lab/core/features/deployment'
import type { ConnectedWallet } from '@dbc-config-lab/core/features/wallet'
import type { SolanaNetwork } from '@dbc-config-lab/core/core/shared'

export interface ConfigDeployProps {
  target: DeployTarget
  network: SolanaNetwork
  connected: ConnectedWallet | null
  mainnetAcknowledged: boolean
}
