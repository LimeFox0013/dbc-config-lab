import type { SolanaNetwork } from '../shared'

export interface QuoteTokenSpec {
  symbol: string
  decimals: number
  /** Mint address per network. */
  mints: Record<SolanaNetwork, string>
  /** Smallest graduation threshold, in whole tokens, the migration keepers act on. */
  keeperMinimumThreshold: number
  /** SOL one whole token is worth when converting scenario budgets and results. */
  solPerToken: number
}
