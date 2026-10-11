import type BN from 'bn.js'
import type { VirtualPool } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { MigratedPool, PulledLiquidity } from '../migrated-pool'
import type { FeeToken, TradeSide, TradeStatus, Venue } from './constants'

interface TradeBase {
  /** Seconds since the pool activated. */
  at: number
  trader: string
}

/** A trade whose side and size are known before the replay reaches it. */
export type ExecutableTrade =
  | (TradeBase & {
      side: TradeSide.Buy | TradeSide.Sell
      /** Quote base units for a buy, base units for a sell. */
      amountIn: BN
    })
  | (TradeBase & { side: TradeSide.SellAll })

/**
 * A trade decided when the replay reaches it: a buy of `clip` while the live price is more
 * than `gapBps` below the fair price, a sale worth about `clip` while it is that far above
 * (up to the trader's holding), otherwise nothing.
 */
export type FairPriceTrade = TradeBase & {
  side: TradeSide.TowardFairPrice
  /** Quote base units per base unit, scaled by 2^128 like sqrtPrice². */
  fairPriceX128: BN
  /** Quote base units. */
  clip: BN
  gapBps: number
}

export type Trade = ExecutableTrade | FairPriceTrade

export interface FeeShares {
  partner: BN
  creator: BN
  protocol: BN
  referral: BN
}

export interface TradeOutcome {
  /** The trade as executed; a fair-price trade appears as the buy or sale it became. */
  trade: ExecutableTrade
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
  /** Fees a compounding migrated pool kept in its own liquidity, in quote base units. */
  compounded: BN
  /** What the unlocked-liquidity withdrawal at graduation returned, or null if none happened. */
  liquidityPulled: PulledLiquidity | null
  /** The migrated pool after the replay, or null if the launch never graduated. */
  migratedPool: MigratedPool | null
}

export interface SimulationOptions {
  /** Whoever holds unlocked liquidity in the migrated pool withdraws it right after graduation. */
  unlockedLiquidityPulled: boolean
  /**
   * The trader who, after the last trade, sells every token the config vests to the creator
   * into the graduated pool; null when nobody does. Vested tokens exist only after graduation.
   */
  vestedTokensSeller: Trade['trader'] | null
}

export interface FirstBuyQuote {
  /** Base units the buy receives. */
  amountOut: BN
  /** Quote base units it spends, fee included. */
  amountInUsed: BN
  /** The base fee the program charges this buy. */
  baseFeeBps: number
  /** The config lets the creator's bundled first buy pay only the minimum fee. */
  atMinimumFee: boolean
}
