import { afterEach, describe, expect, it, vi } from 'vitest'
import BN from 'bn.js'
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import {
  CreatorService,
  PartnerService,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { connectionFor } from '../config-deploy'
import { FeeRole, prepareFeeClaim } from '.'
import { SolanaNetwork } from '../shared'

const owner = Keypair.generate().publicKey
const pool = Keypair.generate().publicKey
const payerInstruction = () =>
  new Transaction().add(
    new TransactionInstruction({
      programId: PublicKey.default,
      keys: [{ pubkey: owner, isSigner: true, isWritable: true }],
    }),
  )

afterEach(() => {
  vi.restoreAllMocks()
})

const passingDryRun = () => {
  const connection = connectionFor(SolanaNetwork.Devnet)
  vi.spyOn(connection, 'getLatestBlockhash').mockResolvedValue({
    blockhash: Keypair.generate().publicKey.toBase58(),
    lastValidBlockHeight: 1,
  })
  vi.spyOn(connection, 'simulateTransaction').mockResolvedValue({
    context: { slot: 1 },
    value: {
      err: null,
      logs: [],
      accounts: null,
      unitsConsumed: 0,
      returnData: null,
    },
  })
  return connection
}

describe('prepareFeeClaim', () => {
  const request = (role: FeeRole) => ({
    pool,
    role,
    network: SolanaNetwork.Devnet,
    owner,
    maxQuoteAmount: new BN(1_197_380),
    maxBaseAmount: new BN(0),
    vault: null,
    config: null,
  })

  it('claims as partner with the wallet as fee claimer and payer, capped at the unclaimed amounts', async () => {
    const partner = vi
      .spyOn(PartnerService.prototype, 'claimPartnerTradingFee')
      .mockResolvedValue(payerInstruction())
    const creator = vi.spyOn(CreatorService.prototype, 'claimCreatorTradingFee')
    const result = await prepareFeeClaim(
      passingDryRun(),
      request(FeeRole.Partner),
    )
    expect(result).toMatchObject({
      ok: true,
      claim: {
        summary: {
          role: FeeRole.Partner,
          receiver: owner.toBase58(),
          quoteAmount: '1197380',
        },
      },
    })
    expect(partner).toHaveBeenCalledWith(
      expect.objectContaining({
        feeClaimer: owner,
        payer: owner,
        pool,
        maxQuoteAmount: new BN(1_197_380),
        maxBaseAmount: new BN(0),
      }),
    )
    expect(creator).not.toHaveBeenCalled()
  })

  it('claims as creator through the creator call', async () => {
    const creator = vi
      .spyOn(CreatorService.prototype, 'claimCreatorTradingFee')
      .mockResolvedValue(payerInstruction())
    const result = await prepareFeeClaim(
      passingDryRun(),
      request(FeeRole.Creator),
    )
    expect(result.ok).toBe(true)
    expect(creator).toHaveBeenCalledWith(
      expect.objectContaining({ creator: owner, payer: owner }),
    )
  })

  it('reports a failing claim instead of offering it for signing', async () => {
    vi.spyOn(
      PartnerService.prototype,
      'claimPartnerTradingFee',
    ).mockRejectedValue(new Error('not the fee claimer'))
    expect(
      await prepareFeeClaim(passingDryRun(), request(FeeRole.Partner)),
    ).toEqual({
      ok: false,
      reason: 'not the fee claimer',
    })
  })
})
