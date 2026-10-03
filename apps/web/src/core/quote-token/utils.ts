import BN from 'bn.js'
import { QUOTE_TOKEN_ORDER, QUOTE_TOKENS } from './constants'
import type { QuoteToken } from './constants'
import type { SolanaNetwork } from '../shared'
import { wholeTokens } from '../shared'

/** A SOL amount as the quote token's base units, at the reference rate. */
export const quoteUnitsFromSol = (sol: number, quote: QuoteToken): BN => {
  const { decimals, solPerToken } = QUOTE_TOKENS[quote]
  return new BN(Math.round((sol / solPerToken) * 10 ** decimals))
}

/** Quote base units as SOL, at the reference rate; float precision is ample for display. */
export const solFromQuoteUnits = (units: BN, quote: QuoteToken): number => {
  const { decimals, solPerToken } = QUOTE_TOKENS[quote]
  return (Number(units.toString()) / 10 ** decimals) * solPerToken
}

/** Quote base units as whole tokens. */
export const wholeQuoteTokens = (units: BN, quote: QuoteToken): number =>
  wholeTokens(units, QUOTE_TOKENS[quote].decimals)

/** The quote token a mint address is on `network`; null when unsupported there. */
export const quoteTokenOfMint = (
  mint: string,
  network: SolanaNetwork,
): QuoteToken | null =>
  QUOTE_TOKEN_ORDER.find(
    (quote) => QUOTE_TOKENS[quote].mints[network] === mint,
  ) ?? null

/** Whether Meteora's migration keepers graduate a pool with this threshold automatically. */
export const keepersMigrate = (
  migrationQuoteThreshold: BN,
  quote: QuoteToken,
): boolean =>
  wholeQuoteTokens(migrationQuoteThreshold, quote) >=
  QUOTE_TOKENS[quote].keeperMinimumThreshold
