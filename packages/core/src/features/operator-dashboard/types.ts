import type { QuoteToken } from '../../core/quote-token'
import type { OperatorRejection } from './constants'

/** One config the wallet collects fees for; amounts in SOL, null when its quote token is unpriced. */
export interface OperatorConfig {
  config: string
  quoteToken: QuoteToken | null
  launches: number
  graduated: number
  /** The fee wallet's share of all bonding-curve trading fees its pools have taken. */
  curveFeesSol: number | null
  /** Of those, what the fee wallet has not claimed yet. */
  unclaimedSol: number | null
}

/** What the wallet's graduated-pool positions in one quote token have earned. */
export interface OperatorPositions {
  quoteToken: QuoteToken
  held: number
  read: number
  /** Claimed plus pending, scaled to every held position when only a sample was read. */
  feesSol: number
}

export interface OperatorReport {
  owner: string
  configs: OperatorConfig[]
  positions: OperatorPositions[]
  /** ISO time the figures were read. */
  readAt: string
}

export type OperatorResult =
  | { ok: true; report: OperatorReport }
  | { ok: false; rejection: OperatorRejection; detail?: string }

/** Sums over every config and position, in SOL. */
export interface OperatorTotals {
  launches: number
  graduated: number
  curveFeesSol: number
  unclaimedSol: number
  afterGraduationSol: number
}
