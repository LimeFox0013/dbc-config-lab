import { SolanaNetwork } from '../shared'
import type { QuoteTokenSpec } from './types'

/** Tokens a launch can be priced in. */
export enum QuoteToken {
  Sol = 'sol',
  Usdc = 'usdc',
}

/** Display and editor order. */
export const QUOTE_TOKEN_ORDER: readonly QuoteToken[] = [
  QuoteToken.Sol,
  QuoteToken.Usdc,
]

/**
 * Scenarios are written in SOL. A config priced in another token has its traders' budgets
 * and its results converted at this fixed rate, stated wherever such figures are shown.
 */
export const REFERENCE_USD_PER_SOL = 150

/**
 * Keeper minimums are Meteora's published migration thresholds: below them the migration
 * keepers do not graduate a pool automatically. Docs: developer-guides/dbc, "Migration Keepers".
 */
export const QUOTE_TOKENS: Record<QuoteToken, QuoteTokenSpec> = {
  [QuoteToken.Sol]: {
    symbol: 'SOL',
    decimals: 9,
    mints: {
      [SolanaNetwork.Mainnet]: 'So11111111111111111111111111111111111111112',
      [SolanaNetwork.Devnet]: 'So11111111111111111111111111111111111111112',
    },
    keeperMinimumThreshold: 10,
    solPerToken: 1,
  },
  [QuoteToken.Usdc]: {
    symbol: 'USDC',
    decimals: 6,
    mints: {
      [SolanaNetwork.Mainnet]: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      // Circle's devnet USDC.
      [SolanaNetwork.Devnet]: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    },
    keeperMinimumThreshold: 750,
    solPerToken: 1 / REFERENCE_USD_PER_SOL,
  },
}
