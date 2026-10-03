import type { PartnerBranding } from '../../core/partner-branding'
import type { OnChainConfig } from '../onchain-config'
import type { LoadRejection } from '../onchain-config'
import type { LaunchPageStatus } from './constants'

export type LaunchPageState =
  | { status: LaunchPageStatus.Loading }
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
    }
