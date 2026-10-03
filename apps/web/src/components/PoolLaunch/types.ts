import type { ConnectedWallet } from '../../features/wallet'
import type { SolanaNetwork } from '../../core/shared'

export interface PoolLaunchProps {
  network: SolanaNetwork
  connected: ConnectedWallet | null
  mainnetAcknowledged: boolean
  /** The config to launch on: the one deployed in this session, or the launch page's. */
  initialConfigAddress: string
  /** On a launchpad's own page the config is fixed; elsewhere the user may enter any other. */
  configLocked?: boolean
}
