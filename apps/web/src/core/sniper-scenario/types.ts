import type BN from 'bn.js'
import type { SimulationResult } from '../launch-simulator'
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
}

/** The program's base fee in bps for a buy of `amountIn` at second `at`. */
export type FeeBpsAt = (at: number, amountIn: BN) => number

/** Quote amounts in lamports, base amounts in token base units. */
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
  graduated: boolean
  /** Seconds from launch to graduation; null when it never graduated. */
  graduationSeconds: number | null
  /** SOL the bonding curve collected. */
  raised: number
  /** Largest drop from a running peak along the traded price path, 0–100. */
  maxDrawdownPercent: number
  /** Share (0–1) of tokens bought in the early window that went to bots; null with no early buys. */
  botShareOfEarlyBuys: number | null
}
