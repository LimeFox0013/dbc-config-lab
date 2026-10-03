import { describe, expect, it, vi } from 'vitest'
import { DYNAMIC_FEE_SHARING_PROGRAM_ID } from '@meteora-ag/dynamic-fee-sharing-sdk'
import { RoyaltyRejection } from '../preset-royalty'
import { Keypair } from '@solana/web3.js'
import type { Connection } from '@solana/web3.js'
import BN from 'bn.js'
import {
  CollectFeeMode,
  MigratedCollectFeeMode,
  MigrationFeeOption,
  TokenAuthorityOption,
  TokenType,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import {
  compileLaunchConfig,
  DEFAULT_LAUNCH_CONFIG,
  withQuoteToken,
} from '../launch-config'
import { QUOTE_TOKENS, QuoteToken } from '../quote-token'
import {
  configTerms,
  connectionFor,
  explorerAddressUrl,
  explorerTransactionUrl,
  MAINNET_RPC_PROXY_PATH,
  prepareDeployment,
  prepareParametersDeployment,
  rpcEndpointFor,
  websocketEndpointFor,
} from '.'
import { SolanaNetwork } from '../shared'

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
      royalty: null,
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
      royalty: null,
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
      royalty: null,
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
      royalty: null,
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
      lockedVesting: { totalTokens: 0 },
      partnerLiquidityVesting: null,
      creatorLiquidityVesting: null,
      migrationPoolFeeBps: 200,
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
      royalty: null,
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

describe('configTerms', () => {
  const compiled = compileLaunchConfig(DEFAULT_LAUNCH_CONFIG)
  if (!compiled.ok) throw new Error(compiled.reason)
  const base = compiled.parameters
  const DAY = 86_400
  const tokens = (whole: number) =>
    new BN(whole).mul(new BN(10).pow(new BN(base.tokenDecimal)))

  it('shows every term that decides who gets the graduation liquidity, and when', () => {
    const terms = configTerms(
      {
        ...base,
        partnerLiquidityPercentage: 0,
        partnerPermanentLockedLiquidityPercentage: 10,
        creatorLiquidityPercentage: 0,
        creatorPermanentLockedLiquidityPercentage: 0,
        creatorLiquidityVestingInfo: {
          vestingPercentage: 90,
          bpsPerPeriod: 0,
          numberOfPeriods: 12,
          cliffDurationFromMigrationTime: 365 * DAY,
          frequency: 30 * DAY,
        },
      },
      QuoteToken.Sol,
    )
    expect(terms.partnerLiquidityVesting).toBeNull()
    expect(terms.creatorLiquidityVesting).toEqual({
      percentage: 90,
      cliffSeconds: 365 * DAY,
      periods: 12,
      periodSeconds: 30 * DAY,
    })
  })

  it('shows the graduated pool fee, how fees are taken, supply, token program and vesting schedule', () => {
    const terms = configTerms(
      {
        ...base,
        collectFeeMode: CollectFeeMode.OutputToken,
        migrationFeeOption: MigrationFeeOption.Customizable,
        migratedPoolFee: {
          ...base.migratedPoolFee,
          collectFeeMode: MigratedCollectFeeMode.Compounding,
          poolFeeBps: 1000,
        },
        compoundingFeeBps: 2500,
        tokenType: TokenType.Token2022,
        tokenSupply: {
          preMigrationTokenSupply: tokens(1_000_000_000),
          postMigrationTokenSupply: tokens(900_000_000),
        },
        lockedVesting: {
          amountPerPeriod: tokens(1_000),
          cliffDurationFromMigrationTime: new BN(7 * DAY),
          frequency: new BN(DAY),
          numberOfPeriod: new BN(10),
          cliffUnlockAmount: tokens(5_000),
        },
      },
      QuoteToken.Sol,
    )
    expect(terms).toMatchObject({
      feesCollectedIn: CollectFeeMode.OutputToken,
      migrationPoolFeeBps: 1000,
      graduatedFeesCollectedIn: MigratedCollectFeeMode.Compounding,
      compoundingFeeBps: 2500,
      tokenType: TokenType.Token2022,
      fixedSupply: { preMigration: 1_000_000_000, postMigration: 900_000_000 },
      lockedVesting: {
        totalTokens: 15_000,
        cliffTokens: 5_000,
        cliffSeconds: 7 * DAY,
        tokensPerPeriod: 1_000,
        periods: 10,
        periodSeconds: DAY,
      },
    })
  })
})

describe('deploying a preset with a royalty', () => {
  const owner = Keypair.generate().publicKey
  const author = Keypair.generate().publicKey.toBase58()
  const compiled = compileLaunchConfig(DEFAULT_LAUNCH_CONFIG)
  if (!compiled.ok) throw new Error(compiled.reason)

  it('creates the splitting vault and the config in one transaction, the vault claiming the fees', async () => {
    const connection = connectionFor(SolanaNetwork.Devnet)
    mockPassingDryRun(connection)
    const result = await prepareParametersDeployment(connection, {
      parameters: compiled.parameters,
      quoteToken: QuoteToken.Sol,
      network: SolanaNetwork.Devnet,
      owner,
      royalty: { author, sharePercent: 10 },
    })
    if (!result.ok) throw new Error(result.reason)
    const { transaction, summary } = result.deployment
    expect(transaction.instructions).toHaveLength(2)
    expect(
      transaction.instructions[0]?.programId.equals(
        DYNAMIC_FEE_SHARING_PROGRAM_ID,
      ),
    ).toBe(true)
    expect(summary.royalty).toMatchObject({
      deployer: owner.toBase58(),
      author,
      authorPercent: 10,
      deployerPercent: 90,
    })
    expect(summary.feeClaimer).toBe(summary.royalty?.vault)
    expect(summary.leftoverReceiver).toBe(owner.toBase58())
  })

  it('refuses a royalty on a config that takes fees in the launched token', async () => {
    const connection = connectionFor(SolanaNetwork.Devnet)
    const blockhash = vi.spyOn(connection, 'getLatestBlockhash')
    expect(
      await prepareParametersDeployment(connection, {
        parameters: {
          ...compiled.parameters,
          collectFeeMode: CollectFeeMode.OutputToken,
        },
        quoteToken: QuoteToken.Sol,
        network: SolanaNetwork.Devnet,
        owner,
        royalty: { author, sharePercent: 10 },
      }),
    ).toEqual({ ok: false, reason: RoyaltyRejection.FeesInLaunchedToken })
    expect(blockhash).not.toHaveBeenCalled()
  })
})

describe('rpcEndpointFor', () => {
  it('sends a page to its own mainnet proxy and scripts to the public endpoints', () => {
    expect(rpcEndpointFor(SolanaNetwork.Mainnet, 'https://lab.example')).toBe(
      `https://lab.example${MAINNET_RPC_PROXY_PATH}`,
    )
    expect(rpcEndpointFor(SolanaNetwork.Devnet, 'https://lab.example')).toBe(
      'https://api.devnet.solana.com',
    )
    expect(rpcEndpointFor(SolanaNetwork.Mainnet, null)).toBe(
      'https://api.mainnet-beta.solana.com',
    )
  })

  it('keeps the websocket at the same address, port included', () => {
    expect(websocketEndpointFor('http://localhost:5180/rpc/mainnet')).toBe(
      'ws://localhost:5180/rpc/mainnet',
    )
    expect(websocketEndpointFor('https://api.devnet.solana.com')).toBe(
      'wss://api.devnet.solana.com',
    )
  })
})
