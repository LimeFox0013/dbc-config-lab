import { describe, expect, it } from 'vitest'
import BN from 'bn.js'
import { FeeRole } from '../../core/fee-claim'
import { QUOTE_TOKENS, QuoteToken } from '../../core/quote-token'
import { SolanaNetwork } from '../../core/shared'
import { earningsRows, vaultShareRow } from '.'

const SOL_MINT = QUOTE_TOKENS[QuoteToken.Sol].mints[SolanaNetwork.Devnet]
/** sqrtPrice of 2^64: one quote base unit per base unit. */
const UNIT_PRICE = new BN(1).shln(64)

const pool = (
  name: string,
  fees: Partial<Record<'pq' | 'pb' | 'cq' | 'cb', number>>,
) => ({
  pool: name,
  config: 'config',
  sqrtPrice: UNIT_PRICE,
  partnerQuoteFee: new BN(fees.pq ?? 0),
  partnerBaseFee: new BN(fees.pb ?? 0),
  creatorQuoteFee: new BN(fees.cq ?? 0),
  creatorBaseFee: new BN(fees.cb ?? 0),
})

describe('earningsRows', () => {
  const pools = [
    pool('both', { pq: 2_000_000_000, cq: 1_000_000_000 }),
    pool('base-only', { pb: 500_000_000 }),
    pool('nothing', {}),
  ]

  it('lists only pools with something to claim, in the role asked for', () => {
    const partner = earningsRows(
      pools,
      FeeRole.Partner,
      () => SOL_MINT,
      SolanaNetwork.Devnet,
    )
    expect(partner.map((r) => r.pool)).toEqual(['both', 'base-only'])
    expect(partner[0]).toMatchObject({
      role: FeeRole.Partner,
      quoteToken: QuoteToken.Sol,
      valueSol: 2,
    })
    // Base-token fees are valued at the pool's price: 1 quote unit each here.
    expect(partner[1]?.valueSol).toBeCloseTo(0.5, 9)

    const creator = earningsRows(
      pools,
      FeeRole.Creator,
      () => SOL_MINT,
      SolanaNetwork.Devnet,
    )
    expect(creator.map((r) => [r.pool, r.valueSol])).toEqual([['both', 1]])
  })

  it('keeps a pool in a token it cannot price claimable, without a SOL value', () => {
    const [row] = earningsRows(
      pools,
      FeeRole.Partner,
      () => 'SomeOtherMint1111111111111111111111111111111',
      SolanaNetwork.Devnet,
    )
    expect(row).toMatchObject({ quoteToken: null, valueSol: null })
  })

  it('skips a pool whose config it could not read', () => {
    expect(
      earningsRows(
        pools,
        FeeRole.Partner,
        () => undefined,
        SolanaNetwork.Devnet,
      ),
    ).toEqual([])
  })
})

describe('royalty vault rows', () => {
  it('offers to collect a pool\u2019s launchpad fees into the vault, naming vault and config', () => {
    const [row] = earningsRows(
      [pool('p1', { pq: 500, cq: 9 })],
      FeeRole.VaultCollect,
      () => SOL_MINT,
      SolanaNetwork.Devnet,
      () => 'vault',
    )
    expect(row).toMatchObject({
      role: FeeRole.VaultCollect,
      unclaimedQuote: new BN(500),
      vault: 'vault',
      config: 'config',
    })
  })

  it('shows a recipient\u2019s unclaimed share, and nothing when none is owed', () => {
    expect(
      vaultShareRow('vault', SOL_MINT, new BN(0), SolanaNetwork.Devnet),
    ).toEqual([])
    const [row] = vaultShareRow(
      'vault',
      SOL_MINT,
      new BN(1_000_000_000),
      SolanaNetwork.Devnet,
    )
    expect(row).toMatchObject({
      role: FeeRole.VaultShare,
      pool: 'vault',
      vault: 'vault',
      config: null,
      valueSol: 1,
    })
  })
})
