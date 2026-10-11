import type { CloneAdjustments } from '../../core/config-clone'
import type { PartnerBranding } from '../../core/partner-branding'
import type { TokenMetadata } from '../../core/pool-launch'
import type { SolanaNetwork } from '../../core/shared'
import type { SharedConfig } from '../config-sharing'
import type { DeployTarget } from '../deployment'
import type { CloneStatus, HandoffAction, HandoffRejection } from './constants'

/** What every proposed action names: where it runs and the only wallet that may sign it. */
interface IntentBase {
  network: SolanaNetwork
  /** Base58 address of the wallet that pays, owns and receives. */
  owner: string
}

export type HandoffIntent = IntentBase &
  (
    | { action: HandoffAction.Deploy; shared: SharedConfig }
    | {
        action: HandoffAction.Clone
        sourceAddress: string
        sourceNetwork: SolanaNetwork
        adjustments: CloneAdjustments
      }
    | { action: HandoffAction.Branding; branding: PartnerBranding }
    | {
        action: HandoffAction.Launch
        configAddress: string
        metadata: TokenMetadata
        /** Whole quote tokens; 0 for none. */
        firstBuy: number
      }
    | { action: HandoffAction.Claim }
  )

export type HandoffResult =
  | { ok: true; intent: HandoffIntent }
  | { ok: false; rejection: HandoffRejection; detail?: string }

/** A proposed clone, ready to deploy — or why its original cannot be cloned as proposed. */
export type HandoffCloneResult =
  { ok: true; target: DeployTarget } | { ok: false; reason: string }

export type HandoffCloneState =
  | { status: CloneStatus.Loading }
  | { status: CloneStatus.Refused; reason: string }
  | { status: CloneStatus.Ready; target: DeployTarget }

/** What a proposed clone names: its original on chain and the adjustments to apply. */
export type CloneSource = Pick<
  Extract<HandoffIntent, { action: HandoffAction.Clone }>,
  'sourceAddress' | 'sourceNetwork' | 'adjustments'
>
