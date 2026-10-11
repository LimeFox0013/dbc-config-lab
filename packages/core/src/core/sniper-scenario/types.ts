import type BN from 'bn.js'
import type { SimulationResult } from '../launch-simulator'
import type { QuoteToken } from '../quote-token'
import type { TraderGroup } from './constants'

export interface Range {
  min: number
  max: number
}

export interface ScenarioSpec {
  seed: number
  snipers: {
    count: number
    /** Snipers buy at a random moment in [0, buyWithinSeconds]. */
    buyWithinSeconds: number
    solPerBuy: Range
    /** Each sniper sells its whole holding this long after buying. */
    holdSeconds: number
  }
  humans: {
    count: number
    arriveFromSeconds: number
    arriveUntilSeconds: number
    solPerBuy: Range
  }
  /** Bots that wait until the fee for their buy is at most `maxFeeBps`, then buy and dump like snipers. */
  adaptiveSnipers: {
    count: number
    maxFeeBps: number
    /** Buy at this second even if the fee never fell far enough. */
    maxWaitSeconds: number
    solPerBuy: Range
    holdSeconds: number
  }
  /**
   * Traders who know the token's outside price — a tokenized stock's listing, say — and
   * trade the launch toward it: buying while it is cheaper, selling while it is dearer.
   * With any of them present, tokens still held at the end are valued at that price.
   */
  arbitrageurs: {
    count: number
    /** The outside price, as the market cap it gives the whole supply. */
    fairMarketCapSol: number
    /** Each trader looks at the price this often... */
    checkEverySeconds: number
    /** ...until this long after launch. */
    untilSeconds: number
    /** Trades only when the price is at least this far from the outside one. */
    gapBps: number
    /** Size of each trade. */
    solPerTrade: Range
  }
  /** Unlocked liquidity in the migrated pool is withdrawn right after graduation. */
  unlockedLiquidityPulled: boolean
  /** The creator sells every token the config vests to them into the graduated pool after the last trade. */
  vestedTokensSold: boolean
}

/** The program's base fee in bps for a buy of `amountIn` at second `at`. */
export type FeeBpsAt = (at: number, amountIn: BN) => number

/** What trade generation needs to know about the config the trades will run against. */
export interface TradeContext {
  feeBpsAt: FeeBpsAt
  quote: QuoteToken
  /** The outside price per base unit, 2^128-scaled; null when the scenario has none. */
  fairPriceX128: BN | null
}

/** Quote amounts in the quote token's base units, base amounts in token base units. */
export interface GroupOutcome {
  group: TraderGroup
  traders: number
  spent: BN
  received: BN
  feesPaid: BN
  tokensHeld: BN
  /** Quote the tokens still held would fetch if the group sold them in one trade at the end. */
  heldValue: BN
  /** received + heldValue − spent; negative is a loss. */
  profit: BN
}

export interface ScenarioResult {
  simulation: SimulationResult
  groups: Record<TraderGroup, GroupOutcome>
  /** The outside price the run was valued at; null when it had none. */
  fairPriceX128: BN | null
}

/** A scenario outcome reduced to SOL figures, for comparing and ranking configs. */
export interface ScenarioMetrics {
  sniperProfit: number
  adaptiveSniperProfit: number
  humanProfit: number
  humanFees: number
  /** Partner + creator fees on the bonding curve. */
  partnerCreatorFees: number
  /** Partner + creator fees on the migrated pool after graduation. */
  postGraduationFees: number
  /** Fees a compounding migrated pool kept in its own liquidity instead of paying out. */
  compoundedFees: number
  graduated: boolean
  /** Seconds from launch to graduation; null when it never graduated. */
  graduationSeconds: number | null
  /** SOL the bonding curve collected. */
  raised: number
  /** Largest drop from a running peak along the traded price path, 0–100. */
  maxDrawdownPercent: number
  /** Share (0–1) of tokens bought in the early window that went to bots; null with no early buys. */
  botShareOfEarlyBuys: number | null
  /** SOL worth of liquidity withdrawn right after graduation; null when none was. */
  liquidityPulled: number | null
  /** SOL the creator got for their vested tokens; null when none were sold. */
  vestedTokensSold: number | null
  arbitrageProfit: number
  /** How far the final price sits from the outside price, in percent; null without one. */
  fairValueGapPercent: number | null
}
