import { Keypair } from '@solana/web3.js'
import BN from 'bn.js'
import { FeeRole } from '@dbc-config-lab/core/core/fee-claim'
import {
  EarningsRejection,
  findEarnings,
} from '@dbc-config-lab/core/features/earnings'
import type * as Earnings from '@dbc-config-lab/core/features/earnings'
import type * as LaunchPage from '@dbc-config-lab/core/features/launch-page'
import type * as RealLaunchesModule from '@dbc-config-lab/core/features/real-launches'
import type { EarningsRow } from '@dbc-config-lab/core/features/earnings'
import {
  compileLaunchConfig,
  DEFAULT_LAUNCH_CONFIG,
} from '@dbc-config-lab/core/core/launch-config'
import { QuoteToken } from '@dbc-config-lab/core/core/quote-token'
import { SolanaNetwork } from '@dbc-config-lab/core/core/shared'
import {
  LaunchPageStatus,
  readLaunchPage,
} from '@dbc-config-lab/core/features/launch-page'
import {
  countGraduatedPools,
  fetchRealLaunches,
  RealLaunchesRejection,
} from '@dbc-config-lab/core/features/real-launches'
import type { RealLaunches } from '@dbc-config-lab/core/features/real-launches'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChainService } from './chain.service'

vi.mock(
  '@dbc-config-lab/core/features/launch-page',
  async (importOriginal) => ({
    ...(await importOriginal<typeof LaunchPage>()),
    readLaunchPage: vi.fn(),
  }),
)
vi.mock(
  '@dbc-config-lab/core/features/real-launches',
  async (importOriginal) => ({
    ...(await importOriginal<typeof RealLaunchesModule>()),
    fetchRealLaunches: vi.fn(),
    countGraduatedPools: vi.fn(),
  }),
)
vi.mock('@dbc-config-lab/core/features/earnings', async (importOriginal) => ({
  ...(await importOriginal<typeof Earnings>()),
  findEarnings: vi.fn(),
}))

const compiled = compileLaunchConfig(DEFAULT_LAUNCH_CONFIG)
if (!compiled.ok) throw new Error(compiled.reason)
const configAddress = Keypair.generate().publicKey.toBase58()

describe('ChainService.configState', () => {
  beforeEach(() => {
    vi.mocked(readLaunchPage).mockResolvedValue({
      status: LaunchPageStatus.Ready,
      config: {
        configAddress,
        network: SolanaNetwork.Devnet,
        feeClaimer: Keypair.generate().publicKey.toBase58(),
        parameters: compiled.parameters,
        quoteToken: QuoteToken.Sol,
      },
      branding: null,
      royalty: null,
    })
  })
  afterEach(() => vi.resetAllMocks())

  it('reads a config nobody has launched on as zero pools, so its first pool is a new pool', async () => {
    vi.mocked(fetchRealLaunches).mockResolvedValue({
      ok: false,
      rejection: RealLaunchesRejection.NoPools,
    })
    const state = await new ChainService().configState(
      SolanaNetwork.Devnet,
      configAddress,
    )
    expect(state).toMatchObject({ totalPools: 0, graduated: 0 })
    expect(countGraduatedPools).not.toHaveBeenCalled()
  })

  it('counts every graduated pool, not the sampled share', async () => {
    // 10% of a 500-pool sample would say 50; the chain holds 73.
    const launches: RealLaunches = {
      totalPools: 900,
      sampledPools: 500,
      completedShare: 0.1,
      migratedShare: 0.1,
      neverTradedShare: 0,
      tractionShare: 0,
      medianRaised: 0,
      meanRaised: 0,
      meanCurveFees: 0,
      medianCurveFees: 0,
      p75CurveFees: 0,
      medianSecondsToComplete: null,
    }
    vi.mocked(fetchRealLaunches).mockResolvedValue({ ok: true, launches })
    vi.mocked(countGraduatedPools).mockResolvedValue(73)
    const state = await new ChainService().configState(
      SolanaNetwork.Devnet,
      configAddress,
    )
    expect(state).toMatchObject({ totalPools: 900, graduated: 73 })
  })

  it('throws when the chain cannot be read, so the poller retries next run', async () => {
    vi.mocked(fetchRealLaunches).mockResolvedValue({
      ok: false,
      rejection: RealLaunchesRejection.NetworkError,
    })
    await expect(
      new ChainService().configState(SolanaNetwork.Devnet, configAddress),
    ).rejects.toThrow()
  })
})

describe('ChainService.feeWalletState', () => {
  const owner = Keypair.generate().publicKey.toBase58()
  const row = (valueSol: number | null): EarningsRow => ({
    pool: Keypair.generate().publicKey.toBase58(),
    role: FeeRole.Partner,
    quoteToken: QuoteToken.Sol,
    quoteMint: 'So11111111111111111111111111111111111111112',
    unclaimedQuote: new BN(0),
    unclaimedBase: new BN(0),
    valueSol,
    vault: null,
    config: null,
  })
  afterEach(() => vi.resetAllMocks())

  it("sums the priced unclaimed fees across the wallet's pools", async () => {
    vi.mocked(findEarnings).mockResolvedValue({
      ok: true,
      earnings: { rows: [row(0.25), row(null), row(1)], totalRows: 3 },
    })
    const state = await new ChainService().feeWalletState(
      SolanaNetwork.Devnet,
      owner,
    )
    expect(state).toEqual({ unclaimedSol: 1.25 })
  })

  it('throws when the chain cannot be read, so the poller retries next run', async () => {
    vi.mocked(findEarnings).mockResolvedValue({
      ok: false,
      rejection: EarningsRejection.NetworkError,
    })
    await expect(
      new ChainService().feeWalletState(SolanaNetwork.Devnet, owner),
    ).rejects.toThrow(EarningsRejection.NetworkError)
  })
})
