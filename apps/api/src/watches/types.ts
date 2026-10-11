import type { SolanaNetwork } from '@dbc-config-lab/core/core/shared'
import type { InferSelectModel } from 'drizzle-orm'
import type { watchEvents, watches } from '../db'
import type { WatchEventType, WatchKind } from './constants'

export type WatchRow = InferSelectModel<typeof watches>
export type WatchEventRow = InferSelectModel<typeof watchEvents>

/** What a launch-config watch remembers between checks. */
export interface ConfigState {
  totalPools: number
  /** Graduated pools — all of them, not a sample. */
  graduated: number
  risks: string[]
}

/** What a fee-wallet watch remembers between checks. */
export interface FeeWalletState {
  unclaimedSol: number
}

export type WatchState = ConfigState | FeeWalletState

export interface WatchChange {
  type: WatchEventType
  before: WatchState | null
  after: WatchState
}

/** One look at a watch's target: its state now, and what changed since the last look. */
export interface WatchObservation {
  state: WatchState
  changes: WatchChange[]
}

/** A watch to add, as the account asked for it. */
export interface NewWatch {
  kind: WatchKind
  target: string
  network: SolanaNetwork
  thresholdSol?: number
}

export interface WatchView {
  id: string
  kind: WatchKind
  target: string
  network: string
  thresholdSol: number | null
  paused: boolean
  lastCheckedAt: string | null
  createdAt: string
}

export interface WatchEventView {
  id: string
  watchId: string
  type: string
  before: unknown
  after: unknown
  seenAt: string
}
