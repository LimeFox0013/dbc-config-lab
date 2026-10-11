import type { PartnerBranding } from '@dbc-config-lab/core/core/partner-branding'
import type { RoyaltySplit } from '@dbc-config-lab/core/core/preset-royalty'
import type { OnChainConfig } from '@dbc-config-lab/core/features/onchain-config'

export interface LaunchpadIdentityProps {
  config: OnChainConfig
  /** Null when the launchpad's operator has published none. */
  branding: PartnerBranding | null
  royalty: RoyaltySplit | null
}
