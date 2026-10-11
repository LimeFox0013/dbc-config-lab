import type { TokenMetadata } from '@dbc-config-lab/core/core/pool-launch'
import type { ConnectedWallet } from '@dbc-config-lab/core/features/wallet'
import type { SolanaNetwork } from '@dbc-config-lab/core/core/shared'

export interface PoolLaunchProps {
  network: SolanaNetwork
  connected: ConnectedWallet | null
  mainnetAcknowledged: boolean
  /** The config to launch on: the one deployed in this session, or the launch page's. */
  initialConfigAddress: string
  /** On a launchpad's own page the config is fixed; elsewhere the user may enter any other. */
  configLocked?: boolean
  /** Fields an agent proposed, filled in for the user to check. */
  initialMetadata?: TokenMetadata
  initialFirstBuy?: number
}
