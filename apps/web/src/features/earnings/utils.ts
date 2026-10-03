import BN from 'bn.js'
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
  vaultOf: (config: string) => string | null = () => null,
): EarningsRow[] =>
  pools.flatMap((pool) => {
    const quoteMint = quoteMintOf(pool.config)
    if (!quoteMint) return []
    const [unclaimedQuote, unclaimedBase] =
      role === FeeRole.Creator
        ? [pool.creatorQuoteFee, pool.creatorBaseFee]
        : [pool.partnerQuoteFee, pool.partnerBaseFee]
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
        vault: vaultOf(pool.config),
        config: role === FeeRole.VaultCollect ? pool.config : null,
      },
    ]
  })

/** A recipient's unclaimed share in a royalty vault, as a row; none when nothing is owed. */
export const vaultShareRow = (
  vault: string,
  tokenMint: string,
  unclaimed: BN,
  network: SolanaNetwork,
): EarningsRow[] => {
  if (unclaimed.isZero()) return []
  const quoteToken = quoteTokenOfMint(tokenMint, network)
  return [
    {
      pool: vault,
      role: FeeRole.VaultShare,
      quoteToken,
      quoteMint: tokenMint,
      unclaimedQuote: unclaimed,
      unclaimedBase: new BN(0),
      valueSol: quoteToken ? solFromQuoteUnits(unclaimed, quoteToken) : null,
      vault,
      config: null,
    },
  ]
}

/** Largest first; unpriced rows after priced ones. */
export const byValue = (a: EarningsRow, b: EarningsRow): number =>
  (b.valueSol ?? -1) - (a.valueSol ?? -1)
