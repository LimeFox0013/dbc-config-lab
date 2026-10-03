import BN from 'bn.js'
import { describe, expect, it } from 'vitest'
import { SolanaNetwork } from '../shared'
import {
  keepersMigrate,
  QUOTE_TOKEN_ORDER,
  QUOTE_TOKENS,
  QuoteToken,
  quoteTokenOfMint,
  quoteUnitsFromSol,
  REFERENCE_USD_PER_SOL,
  solFromQuoteUnits,
} from '.'

describe('quote token amounts', () => {
  it('converts SOL budgets at the reference rate, in each token’s own decimals', () => {
    expect(quoteUnitsFromSol(1.5, QuoteToken.Sol).toString()).toBe('1500000000')
    expect(quoteUnitsFromSol(1, QuoteToken.Usdc).toString()).toBe(
      String(REFERENCE_USD_PER_SOL * 1_000_000),
    )
  })

  it.each(QUOTE_TOKEN_ORDER)('round-trips SOL figures through %s', (quote) => {
    expect(
      solFromQuoteUnits(quoteUnitsFromSol(2.25, quote), quote),
    ).toBeCloseTo(2.25, 9)
  })
})

describe('quoteTokenOfMint', () => {
  it.each(QUOTE_TOKEN_ORDER)('recognises %s on each network', (quote) => {
    Object.values(SolanaNetwork).forEach((network) =>
      expect(
        quoteTokenOfMint(QUOTE_TOKENS[quote].mints[network], network),
      ).toBe(quote),
    )
  })

  it('does not take one network’s mint for another’s', () => {
    expect(
      quoteTokenOfMint(
        QUOTE_TOKENS[QuoteToken.Usdc].mints[SolanaNetwork.Devnet],
        SolanaNetwork.Mainnet,
      ),
    ).toBeNull()
  })

  it('knows nothing of other mints', () => {
    expect(
      quoteTokenOfMint(
        '11111111111111111111111111111111',
        SolanaNetwork.Mainnet,
      ),
    ).toBeNull()
  })
})

describe('keepersMigrate', () => {
  it.each(QUOTE_TOKEN_ORDER)(
    'is true from the published %s minimum, false just below it',
    (quote) => {
      const { keeperMinimumThreshold, decimals } = QUOTE_TOKENS[quote]
      const atMinimum = new BN(keeperMinimumThreshold).mul(
        new BN(10).pow(new BN(decimals)),
      )
      expect(keepersMigrate(atMinimum, quote)).toBe(true)
      expect(keepersMigrate(atMinimum.subn(1), quote)).toBe(false)
    },
  )
})
