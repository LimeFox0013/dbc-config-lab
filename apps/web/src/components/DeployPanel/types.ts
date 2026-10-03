import type { SolanaNetwork } from '../../core/config-deploy'
import type { LaunchPreset } from '../../core/launch-config'
import type { ConnectedWallet } from '../../features/wallet'

export interface DeployPanelProps {
  presets: LaunchPreset[]
  /** Selected at first; a config from someone else's link should never be the default. */
  initialPresetId: LaunchPreset['id']
}

export interface PoolLaunchSectionProps {
  network: SolanaNetwork
  connected: ConnectedWallet | null
  mainnetAcknowledged: boolean
  /** The config deployed in this session, if any; the user may enter any other. */
  initialConfigAddress: string
}
