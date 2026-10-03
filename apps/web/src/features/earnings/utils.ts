import { FeeRole } from '../../core/fee-claim'
import { quoteTokenOfMint, solFromQuoteUnits } from '../../core/quote-token'
import { quoteValueAtSqrtPrice } from '../../core/shared'
import type { SolanaNetwork } from '../../core/shared'
import type { EarningsRow, PoolFees } from './types'

/**
 * The rows a set of pools gives for one role: one per pool with something unclaimed.
 * `quoteMintOf` maps a config address to its quote mint.
 */
export const earningsRows = (
  pools: readonly PoolFees[],
  role: FeeRole,
  quoteMintOf: (config: string) => string | undefined,
  network: SolanaNetwork,
): EarningsRow[] =>
  pools.flatMap((pool) => {
    const quoteMint = quoteMintOf(pool.config)
    if (!quoteMint) return []
    const [unclaimedQuote, unclaimedBase] =
      role === FeeRole.Partner
        ? [pool.partnerQuoteFee, pool.partnerBaseFee]
        : [pool.creatorQuoteFee, pool.creatorBaseFee]
    if (unclaimedQuote.isZero() && unclaimedBase.isZero()) return []
    const quoteToken = quoteTokenOfMint(quoteMint, network)
    const baseInQuote = quoteValueAtSqrtPrice(unclaimedBase, pool.sqrtPrice)
    return [
      {
        pool: pool.pool,
        role,
        quoteToken,
        quoteMint,
        unclaimedQuote,
        unclaimedBase,
        valueSol: quoteToken
          ? solFromQuoteUnits(unclaimedQuote.add(baseInQuote), quoteToken)
          : null,
      },
    ]
  })

/** Largest first; unpriced rows after priced ones. */
export const byValue = (a: EarningsRow, b: EarningsRow): number =>
  (b.valueSol ?? -1) - (a.valueSol ?? -1)
