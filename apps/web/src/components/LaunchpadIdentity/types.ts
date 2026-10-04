import type { PartnerBranding } from '../../core/partner-branding'
import type { RoyaltySplit } from '../../core/preset-royalty'
import type { OnChainConfig } from '../../features/onchain-config'

export interface LaunchpadIdentityProps {
  config: OnChainConfig
  /** Null when the launchpad's operator has published none. */
  branding: PartnerBranding | null
  royalty: RoyaltySplit | null
}
