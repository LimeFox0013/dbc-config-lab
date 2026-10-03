import { afterEach, describe, expect, it, vi } from 'vitest'
import BN from 'bn.js'
import { Keypair } from '@solana/web3.js'
import type { AccountInfo, PublicKey } from '@solana/web3.js'
import {
  ActivationType,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
  getBaseTokenForSwap,
  getMigrationThresholdPrice,
  MAX_SQRT_PRICE,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { connectionFor } from '../../core/config-deploy'
import {
  compileLaunchConfig,
  DEFAULT_LAUNCH_CONFIG,
} from '../../core/launch-config'
import {
  QuoteToken,
  quoteUnitsFromSol,
  solFromQuoteUnits,
} from '../../core/quote-token'
import { poolAccountData } from '../../testing/dbc-accounts'
import { fetchRealLaunches, RealLaunchesRejection } from '.'
import { SolanaNetwork } from '../../core/shared'

const compiled = compileLaunchConfig({
  ...DEFAULT_LAUNCH_CONFIG,
  activationType: ActivationType.Timestamp,
})
if (!compiled.ok) throw new Error(compiled.reason)
const { parameters } = compiled
const sol = (amount: number) => quoteUnitsFromSol(amount, QuoteToken.Sol)
const configAddress = Keypair.generate().publicKey

const metrics = (fees: number) => ({
  totalProtocolBaseFee: new BN(0),
  totalProtocolQuoteFee: new BN(0),
  totalTradingBaseFee: new BN(0),
  totalTradingQuoteFee: sol(fees),
})

/** Four pools: one migrated after 120s, one completed after 60s, one at 5 SOL, one never traded. */
const pools = [
  {
    isMigrated: 1,
    hasSwap: 1,
    quoteReserve: new BN(0),
    finishCurveTimestamp: new BN(1120),
    activationPoint: new BN(1000),
    metrics: metrics(2),
  },
  {
    isMigrated: 0,
    hasSwap: 1,
    quoteReserve: sol(85),
    finishCurveTimestamp: new BN(1060),
    activationPoint: new BN(1000),
    metrics: metrics(1),
  },
  { isMigrated: 0, hasSwap: 1, quoteReserve: sol(5), metrics: metrics(0.5) },
  { isMigrated: 0, hasSwap: 0, quoteReserve: new BN(0), metrics: metrics(0) },
]

const account = (data: Buffer): AccountInfo<Buffer> => ({
  data,
  owner: DYNAMIC_BONDING_CURVE_PROGRAM_ID,
  lamports: 1,
  executable: false,
  rentEpoch: 0,
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchRealLaunches', () => {
  const connection = connectionFor(SolanaNetwork.Mainnet)
  const addresses = pools.map(() => Keypair.generate().publicKey)

  const serve = (keys: PublicKey[]) => {
    vi.spyOn(connection, 'getProgramAccounts').mockResolvedValue(
      keys.map((pubkey) => ({ pubkey, account: account(Buffer.alloc(0)) })),
    )
    const byAddress = new Map(
      addresses.map((a, i) => [
        a.toBase58(),
        poolAccountData(parameters, configAddress, pools[i]),
      ]),
    )
    return vi
      .spyOn(connection, 'getMultipleAccountsInfo')
      .mockImplementation(async (batch) =>
        batch.map((a) => {
          const data = byAddress.get(a.toBase58())
          return data ? account(data) : null
        }),
      )
  }

  it('aggregates how the real pools on a config went, in SOL', async () => {
    serve(addresses)
    const result = await fetchRealLaunches(
      connection,
      configAddress.toBase58(),
      parameters,
      QuoteToken.Sol,
    )
    if (!result.ok) throw new Error(result.rejection)
    expect(result.launches).toMatchObject({
      totalPools: 4,
      sampledPools: 4,
      completedShare: 0.5,
      migratedShare: 0.25,
      neverTradedShare: 0.25,
      tractionShare: 0.5,
      medianSecondsToComplete: 90,
    })
    // A migrated pool raised the full threshold; median of 85, 85, 5, 0.
    expect(result.launches.medianRaised).toBeCloseTo(45, 6)
    expect(result.launches.meanCurveFees).toBeCloseTo(0.875, 6)
  })

  it('values fees in the launched token at the curve average price and counts old pools as traded', async () => {
    const curveTokens = getBaseTokenForSwap(
      parameters.sqrtStartPrice,
      getMigrationThresholdPrice(
        parameters.migrationQuoteThreshold,
        parameters.sqrtStartPrice,
        parameters.curve,
      ),
      parameters.curve,
    )
    // A pool from before the swap flag, its curve ending at an extreme price.
    const oldPool = poolAccountData(parameters, configAddress, {
      isMigrated: 1,
      hasSwap: 0,
      quoteReserve: new BN(0),
      sqrtPrice: MAX_SQRT_PRICE,
      metrics: {
        ...metrics(0),
        totalTradingBaseFee: curveTokens.divn(100),
      },
    })
    const address = Keypair.generate().publicKey
    vi.spyOn(connection, 'getProgramAccounts').mockResolvedValue([
      { pubkey: address, account: account(Buffer.alloc(0)) },
    ])
    vi.spyOn(connection, 'getMultipleAccountsInfo').mockResolvedValue([
      account(oldPool),
    ])
    const result = await fetchRealLaunches(
      connection,
      configAddress.toBase58(),
      parameters,
      QuoteToken.Sol,
    )
    if (!result.ok) throw new Error(result.rejection)
    expect(result.launches.neverTradedShare).toBe(0)
    // 1% of the curve's tokens is worth 1% of what the curve raises.
    expect(result.launches.meanCurveFees).toBeCloseTo(
      solFromQuoteUnits(parameters.migrationQuoteThreshold, QuoteToken.Sol) /
        100,
      6,
    )
  })

  it('leaves out a pool it cannot decode instead of failing', async () => {
    const extra = Keypair.generate().publicKey
    vi.spyOn(connection, 'getProgramAccounts').mockResolvedValue(
      [...addresses, extra].map((pubkey) => ({
        pubkey,
        account: account(Buffer.alloc(0)),
      })),
    )
    const byAddress = new Map([
      ...addresses.map((a, i): [string, Buffer] => [
        a.toBase58(),
        poolAccountData(parameters, configAddress, pools[i]),
      ]),
      [extra.toBase58(), Buffer.alloc(16, 9)],
    ])
    vi.spyOn(connection, 'getMultipleAccountsInfo').mockImplementation(
      async (batch) =>
        batch.map((a) => {
          const data = byAddress.get(a.toBase58())
          return data ? account(data) : null
        }),
    )
    const result = await fetchRealLaunches(
      connection,
      configAddress.toBase58(),
      parameters,
      QuoteToken.Sol,
    )
    expect(result).toMatchObject({
      ok: true,
      launches: { totalPools: 5, sampledPools: 4 },
    })
  })

  it('says so when nobody has launched on the config', async () => {
    serve([])
    expect(
      await fetchRealLaunches(
        connection,
        configAddress.toBase58(),
        parameters,
        QuoteToken.Sol,
      ),
    ).toEqual({ ok: false, rejection: RealLaunchesRejection.NoPools })
  })

  it('reports a failed read instead of throwing', async () => {
    vi.spyOn(connection, 'getProgramAccounts').mockRejectedValue(
      new Error('429 Too Many Requests'),
    )
    expect(
      await fetchRealLaunches(
        connection,
        configAddress.toBase58(),
        parameters,
        QuoteToken.Sol,
      ),
    ).toMatchObject({
      ok: false,
      rejection: RealLaunchesRejection.NetworkError,
      detail: '429 Too Many Requests',
    })
  })
})
