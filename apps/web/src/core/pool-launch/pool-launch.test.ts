import { afterEach, describe, expect, it, vi } from 'vitest'
import BN from 'bn.js'
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type { Connection } from '@solana/web3.js'
import { CreatorService } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { CreatePoolWithFirstBuyParams } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { connectionFor } from '../config-deploy'
import { compileLaunchConfig, LAUNCH_PRESETS } from '../launch-config'
import type { LaunchConfig } from '../launch-config'
import { quoteFirstBuy } from '../launch-simulator'
import { QuoteToken, quoteUnitsFromSol } from '../quote-token'
import { MetadataRejection, metadataRejection, preparePoolLaunch } from '.'
import { SolanaNetwork } from '../shared'

const preset = (id: string): LaunchConfig => {
  const found = LAUNCH_PRESETS.find((p) => p.id === id)
  if (!found) throw new Error(`no preset ${id}`)
  return found.config
}

const compile = (config: LaunchConfig) => {
  const compiled = compileLaunchConfig(config)
  if (!compiled.ok) throw new Error(compiled.reason)
  return compiled.parameters
}

const metadata = { name: 'Test Token', symbol: 'TEST', uri: '' }

describe('metadataRejection', () => {
  it.each([
    [{ ...metadata, name: '  ' }, MetadataRejection.NameMissing],
    [{ ...metadata, name: 'x'.repeat(33) }, MetadataRejection.NameTooLong],
    [{ ...metadata, symbol: '' }, MetadataRejection.SymbolMissing],
    [{ ...metadata, symbol: 'TOOLONGSYMB' }, MetadataRejection.SymbolTooLong],
    [{ ...metadata, uri: 'javascript:alert(1)' }, MetadataRejection.UriScheme],
    [
      { ...metadata, uri: `https://${'a'.repeat(200)}` },
      MetadataRejection.UriTooLong,
    ],
  ])('refuses %o', (input, rejection) => {
    expect(metadataRejection(input)).toBe(rejection)
  })

  it.each(['', 'https://example.com/t.json', 'ipfs://bafy', 'ar://abc'])(
    'accepts the URI %j',
    (uri) => {
      expect(metadataRejection({ ...metadata, uri })).toBeNull()
    },
  )
})

describe('quoteFirstBuy', () => {
  const oneSol = quoteUnitsFromSol(1, QuoteToken.Sol)

  it('charges the config’s opening fee unless its first buy is at the minimum fee', () => {
    const shield = preset('sniper-shield')
    const full = quoteFirstBuy(compile(shield), oneSol)
    const minimum = quoteFirstBuy(
      compile({
        ...shield,
        fee: { ...shield.fee, enableFirstSwapWithMinFee: true },
      }),
      oneSol,
    )
    expect(full).toMatchObject({ baseFeeBps: 9000, atMinimumFee: false })
    expect(minimum).toMatchObject({ baseFeeBps: 100, atMinimumFee: true })
    expect(minimum.amountOut.gt(full.amountOut.muln(5))).toBe(true)
  })
})

describe('preparePoolLaunch', () => {
  const owner = Keypair.generate().publicKey
  const configAddress = Keypair.generate().publicKey

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const passingDryRun = (connection: Connection) => {
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
  }

  /** Records what the SDK was asked to build and returns a transaction the mint key must sign. */
  const recordBuild = () => {
    const calls: CreatePoolWithFirstBuyParams[] = []
    vi.spyOn(
      CreatorService.prototype,
      'createPoolWithFirstBuy',
    ).mockImplementation(async (params) => {
      calls.push(params)
      return new Transaction().add(
        new TransactionInstruction({
          programId: PublicKey.default,
          keys: [
            {
              pubkey: params.createPoolParam.baseMint,
              isSigner: true,
              isWritable: true,
            },
            {
              pubkey: params.createPoolParam.payer,
              isSigner: true,
              isWritable: true,
            },
          ],
        }),
      )
    })
    return calls
  }

  const request = (config: LaunchConfig, firstBuy: number) => ({
    configAddress,
    parameters: compile(config),
    quoteToken: config.quoteToken,
    network: SolanaNetwork.Devnet,
    owner,
    metadata,
    firstBuy,
  })

  it('refuses bad metadata before touching the network', async () => {
    const connection = connectionFor(SolanaNetwork.Devnet)
    const blockhash = vi.spyOn(connection, 'getLatestBlockhash')
    const result = await preparePoolLaunch(connection, {
      ...request(preset('flat'), 0),
      metadata: { ...metadata, symbol: '' },
    })
    expect(result).toEqual({
      ok: false,
      reason: MetadataRejection.SymbolMissing,
    })
    expect(blockhash).not.toHaveBeenCalled()
  })

  it('makes the wallet the creator and payer, signs with the one-off mint only, and quotes the first buy', async () => {
    const connection = connectionFor(SolanaNetwork.Devnet)
    passingDryRun(connection)
    const calls = recordBuild()

    const result = await preparePoolLaunch(
      connection,
      request(preset('flat'), 1),
    )
    if (!result.ok) throw new Error(result.reason)
    const [call] = calls
    if (!call?.firstBuyParam) throw new Error('no first buy built')

    expect(call.createPoolParam).toMatchObject({
      ...metadata,
      poolCreator: owner,
      payer: owner,
      config: configAddress,
    })
    expect(call.firstBuyParam.buyer).toEqual(owner)
    expect(call.firstBuyParam.buyAmount.toString()).toBe('1000000000')
    const expected = quoteFirstBuy(
      compile(preset('flat')),
      new BN(1_000_000_000),
    )
    expect(call.firstBuyParam.minimumAmountOut.lt(expected.amountOut)).toBe(
      true,
    )
    expect(
      call.firstBuyParam.minimumAmountOut.gt(
        expected.amountOut.muln(98).divn(100),
      ),
    ).toBe(true)

    const { transaction, summary } = result.launch
    const signed = transaction.signatures
      .filter((s) => s.signature !== null)
      .map((s) => s.publicKey.toBase58())
    expect(signed).toEqual([summary.mintAddress])
    expect(summary.terms).toMatchObject({
      poolCreationFeeSol: 0,
      creatorTradingFeePercentage: 50,
      quoteToken: QuoteToken.Sol,
    })
    expect(summary).toMatchObject({
      creator: owner.toBase58(),
      configAddress: configAddress.toBase58(),
      firstBuy: { amount: 1, baseFeeBps: 100, atMinimumFee: false },
    })
  })

  it('builds no first buy when none is asked for', async () => {
    const connection = connectionFor(SolanaNetwork.Devnet)
    passingDryRun(connection)
    const calls = recordBuild()
    const result = await preparePoolLaunch(
      connection,
      request(preset('flat'), 0),
    )
    expect(result).toMatchObject({
      ok: true,
      launch: { summary: { firstBuy: null } },
    })
    expect(calls[0]?.firstBuyParam).toBeUndefined()
  })

  it('takes a USDC first buy in USDC', async () => {
    const connection = connectionFor(SolanaNetwork.Devnet)
    passingDryRun(connection)
    const calls = recordBuild()
    const result = await preparePoolLaunch(
      connection,
      request(preset('stock-listing'), 150),
    )
    expect(result).toMatchObject({
      ok: true,
      launch: { summary: { quoteToken: QuoteToken.Usdc } },
    })
    expect(calls[0]?.firstBuyParam?.buyAmount.toString()).toBe('150000000')
  })
})
