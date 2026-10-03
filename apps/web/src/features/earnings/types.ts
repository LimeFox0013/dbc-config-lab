import type BN from 'bn.js'
import type { FeeRole } from '../../core/fee-claim'
import type { QuoteToken } from '../../core/quote-token'
import type { EarningsRejection } from './constants'

/** Unclaimed trading fees on one pool, for one role the wallet holds there. */
export interface EarningsRow {
  pool: string
  role: FeeRole
  /** Null when the pool's quote token is one the lab cannot price. */
  quoteToken: QuoteToken | null
  quoteMint: string
  unclaimedQuote: BN
  unclaimedBase: BN
  /** Both amounts in SOL at the reference rate (base valued at the pool's price); null when unpriced. */
  valueSol: number | null
}

export interface Earnings {
  rows: EarningsRow[]
  /** Pools with something to claim, before the row limit. */
  totalRows: number
}

export type EarningsResult =
  | { ok: true; earnings: Earnings }
  | { ok: false; rejection: EarningsRejection; detail?: string }

/** What a pool account says about who may claim what. */
export interface PoolFees {
  pool: string
  config: string
  sqrtPrice: BN
  partnerQuoteFee: BN
  partnerBaseFee: BN
  creatorQuoteFee: BN
  creatorBaseFee: BN
}
