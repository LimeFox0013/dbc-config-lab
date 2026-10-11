import { describe, expect, it, vi } from 'vitest'
import { Keypair, PublicKey } from '@solana/web3.js'
import { connectionFor } from '../config-deploy'
import { SolanaNetwork } from '../shared'
import { heldPositionFees, nftMintsOf } from '.'
import { POSITION_NFT_PROGRAM } from './constants'

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

describe('heldPositionFees', () => {
  it('reads nothing more for a wallet holding no position NFTs, pausing before each read', async () => {
    const connection = connectionFor(SolanaNetwork.Devnet)
    const tokens = vi
      .spyOn(connection, 'getParsedTokenAccountsByOwner')
      .mockResolvedValue({ context: { slot: 1 }, value: [] })
    const reads = vi.spyOn(connection, 'getMultipleAccountsInfo')
    const pause = vi.fn(() => Promise.resolve())
    const owner = Keypair.generate().publicKey

    const held = await heldPositionFees(
      connection,
      owner,
      Keypair.generate().publicKey,
      10,
      pause,
    )

    expect(held).toEqual({ held: 0, read: 0, quoteFees: [] })
    expect(tokens).toHaveBeenCalledWith(owner, {
      programId: POSITION_NFT_PROGRAM,
    })
    expect(reads).not.toHaveBeenCalled()
    expect(pause).toHaveBeenCalledTimes(1)
  })
})
