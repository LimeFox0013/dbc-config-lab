import type { PartnerBranding } from '@dbc-config-lab/core/core/partner-branding'
import type { ConnectedWallet } from '@dbc-config-lab/core/features/wallet'
import type { SolanaNetwork } from '@dbc-config-lab/core/core/shared'

export interface BrandingSectionProps {
  network: SolanaNetwork
  connected: ConnectedWallet | null
  mainnetAcknowledged: boolean
  /** The config deployed in this session, whose launch page is offered; empty until one is. */
  configAddress: string
  /** Fields an agent proposed, filled in for the user to check. */
  initialBranding?: PartnerBranding
}
