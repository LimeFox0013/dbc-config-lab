import type { PartnerBranding } from '../../core/partner-branding'
import type { ConnectedWallet } from '../../features/wallet'
import type { SolanaNetwork } from '../../core/shared'

export interface BrandingSectionProps {
  network: SolanaNetwork
  connected: ConnectedWallet | null
  mainnetAcknowledged: boolean
  /** The config deployed in this session, whose launch page is offered; empty until one is. */
  configAddress: string
  /** Fields an agent proposed, filled in for the user to check. */
  initialBranding?: PartnerBranding
}
