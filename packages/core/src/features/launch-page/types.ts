import type { PartnerBranding } from '../../core/partner-branding'
import type { OnChainConfig } from '../onchain-config'
import type { LoadRejection } from '../onchain-config'
import type { LaunchPageStatus } from './constants'

import type { RoyaltySplit } from '../../core/preset-royalty'
/** A finished read of a launch page's config: refused, or ready to show. */
export type LaunchPageRead =
  | {
      status: LaunchPageStatus.Refused
      rejection: LoadRejection
      detail?: string
    }
  | {
      status: LaunchPageStatus.Ready
      config: OnChainConfig
      /** Null when the launchpad's operator has published none. */
      branding: PartnerBranding | null
      /** When a royalty vault claims the fees: who it pays, and how much. */
      royalty: RoyaltySplit | null
    }

export type LaunchPageState =
  { status: LaunchPageStatus.Loading } | LaunchPageRead
