import type BN from 'bn.js'
import type { VirtualPool } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { MigratedPool } from '../migrated-pool'
import type { FeeToken, TradeSide, TradeStatus, Venue } from './constants'

interface TradeBase {
  /** Seconds since the pool activated. */
  at: number
  trader: string
}

export type Trade =
  | (TradeBase & {
      side: TradeSide.Buy | TradeSide.Sell
      /** Quote lamports for a buy, base units for a sell. */
      amountIn: BN
    })
  | (TradeBase & { side: TradeSide.SellAll })

export interface FeeShares {
  partner: BN
  creator: BN
  protocol: BN
  referral: BN
}

export interface TradeOutcome {
  trade: Trade
  venue: Venue
  status: TradeStatus
  /** Input actually consumed, fee included. */
  amountInUsed: BN
  amountOut: BN
  fee: FeeShares
  feeToken: FeeToken
  /** The fee in quote lamports; equals `fee` when it was taken in the quote token. */
  feeValue: FeeShares
  /** Price after the trade on the venue it executed on (Q64 sqrt price, same scale on both). */
  sqrtPriceAfter: BN
  /** The curve's quote reserve after the trade; frozen once the launch has migrated. */
  quoteReserveAfter: BN
  reason?: string
}

export interface SimulationResult {
  outcomes: TradeOutcome[]
  /** Seconds since activation of the trade that completed the curve, or null if it never did. */
  graduatedAt: number | null
  /** Trading fees on the bonding curve. */
  fees: Record<FeeToken, FeeShares>
  /** Trading fees on the migrated pool; partner and creator shares follow their LP split. */
  migratedFees: Record<FeeToken, FeeShares>
  /** Trading fees on each venue in quote lamports, base-token fees valued at their trade's price. */
  feeValue: Record<Venue, FeeShares>
  /** Base units each trader holds after the replay. */
  holdings: Record<Trade['trader'], BN>
  /** Curve state after the replay. */
  finalPool: VirtualPool
  /** The migrated pool after the replay, or null if the launch never graduated. */
  migratedPool: MigratedPool | null
}
