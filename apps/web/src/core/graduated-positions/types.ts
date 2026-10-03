import type BN from 'bn.js'

/** What the graduated-pool positions a wallet holds have earned in one quote token. */
export interface HeldPositionFees {
  /** Position NFTs the wallet holds, of any pool. */
  held: number
  /** Positions read: all of them, or an even sample when there are more than the limit. */
  read: number
  /** Per position read whose pool is priced in the quote mint: quote fees claimed plus pending, in base units. */
  quoteFees: BN[]
}
