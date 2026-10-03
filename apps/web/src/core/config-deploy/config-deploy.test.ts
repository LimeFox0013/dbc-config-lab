import { describe, expect, it, vi } from 'vitest'
import { Keypair } from '@solana/web3.js'
import type { Connection } from '@solana/web3.js'
import {
  MigrationFeeOption,
  TokenAuthorityOption,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { DEFAULT_LAUNCH_CONFIG, withQuoteToken } from '../launch-config'
import { QUOTE_TOKENS, QuoteToken } from '../quote-token'
import {
  connectionFor,
  explorerAddressUrl,
  explorerTransactionUrl,
  prepareDeployment,
  SolanaNetwork,
} from '.'

describe('explorer links', () => {
  it('adds the cluster for devnet and nothing for mainnet', () => {
    expect(explorerTransactionUrl('sig', SolanaNetwork.Devnet)).toBe(
      'https://explorer.solana.com/tx/sig?cluster=devnet',
    )
    expect(explorerAddressUrl('addr', SolanaNetwork.Mainnet)).toBe(
      'https://explorer.solana.com/address/addr',
    )
  })
})

const mockPassingDryRun = (connection: Connection) => {
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

describe('prepareDeployment', () => {
  const owner = Keypair.generate().publicKey

  it('rejects an invalid config before touching the network', async () => {
    const connection = connectionFor(SolanaNetwork.Devnet)
    const blockhash = vi.spyOn(connection, 'getLatestBlockhash')

    const result = await prepareDeployment(connection, {
      config: {
        ...DEFAULT_LAUNCH_CONFIG,
        fee: { ...DEFAULT_LAUNCH_CONFIG.fee, creatorTradingFeePercentage: 150 },
      },
      network: SolanaNetwork.Devnet,
      owner,
    })

    expect(result.ok).toBe(false)
    expect(blockhash).not.toHaveBeenCalled()
  })

  it('reports a failed dry run instead of returning a transaction to sign', async () => {
    const connection = connectionFor(SolanaNetwork.Devnet)
    vi.spyOn(connection, 'getLatestBlockhash').mockResolvedValue({
      blockhash: Keypair.generate().publicKey.toBase58(),
      lastValidBlockHeight: 1,
    })
    vi.spyOn(connection, 'simulateTransaction').mockResolvedValue({
      context: { slot: 1 },
      value: {
        err: 'AccountNotFound',
        logs: ['payer has no SOL'],
        accounts: null,
        unitsConsumed: 0,
        returnData: null,
      },
    })

    const result = await prepareDeployment(connection, {
      config: DEFAULT_LAUNCH_CONFIG,
      network: SolanaNetwork.Devnet,
      owner,
    })

    expect(result).toMatchObject({ ok: false })
    expect(result.ok ? '' : result.reason).toContain('Dry run failed')
  })

  it('returns a transaction signed by the config key only, with a matching summary', async () => {
    const connection = connectionFor(SolanaNetwork.Devnet)
    mockPassingDryRun(connection)

    const result = await prepareDeployment(connection, {
      config: DEFAULT_LAUNCH_CONFIG,
      network: SolanaNetwork.Devnet,
      owner,
    })
    if (!result.ok) throw new Error(result.reason)
    const { transaction, summary } = result.deployment

    expect(transaction.feePayer?.equals(owner)).toBe(true)
    const signed = transaction.signatures
      .filter((s) => s.signature !== null)
      .map((s) => s.publicKey.toBase58())
    expect(signed).toEqual([summary.configAddress])
    expect(summary.payer).toBe(owner.toBase58())
    expect(summary.feeClaimer).toBe(owner.toBase58())
  })

  it('summarises every setting that decides who earns, withdraws and controls the token', async () => {
    const connection = connectionFor(SolanaNetwork.Devnet)
    mockPassingDryRun(connection)

    const result = await prepareDeployment(connection, {
      config: {
        ...DEFAULT_LAUNCH_CONFIG,
        token: {
          ...DEFAULT_LAUNCH_CONFIG.token,
          tokenAuthorityOption: TokenAuthorityOption.CreatorUpdateAuthority,
        },
        fee: { ...DEFAULT_LAUNCH_CONFIG.fee, creatorTradingFeePercentage: 100 },
        liquidityDistribution: {
          partnerLiquidityPercentage: 40,
          partnerPermanentLockedLiquidityPercentage: 10,
          creatorLiquidityPercentage: 40,
          creatorPermanentLockedLiquidityPercentage: 10,
        },
        migration: {
          ...DEFAULT_LAUNCH_CONFIG.migration,
          migrationFeeOption: MigrationFeeOption.FixedBps200,
          migrationFee: { feePercentage: 5, creatorFeePercentage: 50 },
        },
      },
      network: SolanaNetwork.Devnet,
      owner,
    })
    if (!result.ok) throw new Error(result.reason)

    expect(result.deployment.summary).toMatchObject({
      tokenAuthority: TokenAuthorityOption.CreatorUpdateAuthority,
      creatorTradingFeePercentage: 100,
      liquidity: {
        partnerPercentage: 40,
        partnerLockedPercentage: 10,
        creatorPercentage: 40,
        creatorLockedPercentage: 10,
      },
      lockedVestingTokens: 0,
      migrationFeeOption: MigrationFeeOption.FixedBps200,
      migrationFeePercentage: 5,
      migrationCreatorFeePercentage: 50,
      poolCreationFeeSol: 0,
      dynamicFeeEnabled: false,
    })
  })

  it('creates a USDC config against the network’s own USDC mint', async () => {
    const connection = connectionFor(SolanaNetwork.Devnet)
    mockPassingDryRun(connection)

    const result = await prepareDeployment(connection, {
      config: withQuoteToken(DEFAULT_LAUNCH_CONFIG, QuoteToken.Usdc),
      network: SolanaNetwork.Devnet,
      owner,
    })
    if (!result.ok) throw new Error(result.reason)

    const devnetUsdc = QUOTE_TOKENS[QuoteToken.Usdc].mints[SolanaNetwork.Devnet]
    const accounts = result.deployment.transaction.instructions.flatMap((i) =>
      i.keys.map((k) => k.pubkey.toBase58()),
    )
    expect(accounts).toContain(devnetUsdc)
    expect(result.deployment.summary).toMatchObject({
      quoteToken: QuoteToken.Usdc,
      quoteMint: devnetUsdc,
      migrationThreshold: 12_750,
      keepersMigrate: true,
    })
  })
})
