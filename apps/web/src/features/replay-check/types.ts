import type { FeeSetup } from './constants'

/** One real launch whose on-chain history the simulator reproduced exactly. */
export interface ReplayedLaunch {
  /** The DBC pool (bonding curve) the launch traded on. */
  curvePool: string
  curveSwaps: number
  feeSetup: FeeSetup
  /** The DAMM v2 pool it graduated into, when it did. */
  migrated?: {
    pool: string
    swaps: number
    /** The graduated pool compounds part of its fees into its own liquidity. */
    compounding?: boolean
  }
}

/** A type alias, not an interface, so it can be passed as i18n named values. */
export type ReplayTotals = {
  launches: number
  curveSwaps: number
  migrations: number
  migratedSwaps: number
}
