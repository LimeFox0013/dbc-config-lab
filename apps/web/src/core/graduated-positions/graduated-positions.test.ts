import { describe, expect, it } from 'vitest'
import { PublicKey } from '@solana/web3.js'
import { nftMintsOf } from '.'

const MINT = new PublicKey(7).toBase58()
const account = (amount: string, decimals: number, mint: unknown = MINT) => ({
  account: {
    data: {
      parsed: { info: { mint, tokenAmount: { amount, decimals } } },
    },
  },
})

describe('nftMintsOf', () => {
  it('keeps only single, indivisible tokens', () => {
    expect(
      nftMintsOf([
        account('1', 0),
        account('2', 0),
        account('1', 6),
        account('1', 0, 42),
        { account: { data: { parsed: 'raw' } } },
      ]).map((mint) => mint.toBase58()),
    ).toEqual([MINT])
  })
})
