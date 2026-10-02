import BN from 'bn.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Keypair, PublicKey } from '@solana/web3.js'
import type { AccountInfo } from '@solana/web3.js'
import {
  createDbcProgram,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { connectionFor, SolanaNetwork } from '../../core/config-deploy'
import {
  compileLaunchConfig,
  CurveShape,
  DEFAULT_LAUNCH_CONFIG,
  defaultCurve,
  LAUNCH_PRESETS,
  withCurve,
} from '../../core/launch-config'
import type { LaunchConfig } from '../../core/launch-config'
import { toInitialPool, toPoolConfig } from '../../core/launch-simulator/utils'
import {
  DEFAULT_SCENARIO,
  scenarioMetrics,
  SCENARIO_PRESETS,
  ScenarioPresetId,
} from '../../core/sniper-scenario'
// Test-only: Anchor's own account encoder writes into a fixed 1000-byte buffer (upstream
// TODO), too small for a PoolConfig, so fixtures encode with the same IDL layout directly.
import { BorshAccountsCoder } from '@coral-xyz/anchor'
import { IdlCoder } from '@coral-xyz/anchor/dist/cjs/coder/borsh/idl'
import { DbcAccount } from './constants'
import { loadOnChainConfig, LoadRejection } from '.'

/** Stored curves are fixed arrays of 20 points; unused ones are zero. */
const STORED_CURVE_POINTS = 20

const compile = (config: LaunchConfig): ConfigParameters => {
  const compiled = compileLaunchConfig(config)
  if (!compiled.ok) throw new Error(compiled.reason)
  return compiled.parameters
}

const connection = connectionFor(SolanaNetwork.Devnet)
const { program } = createDbcProgram(connection)
const accountsCoder = new BorshAccountsCoder(program.idl)

const FIXTURE_BUFFER_BYTES = 8192

/** Account bytes exactly as the program stores them: discriminator, then the Borsh layout. */
const encodeAccount = (name: DbcAccount, value: unknown): Buffer => {
  const typeDef = program.idl.types?.find((t) => t.name === name)
  if (!typeDef) throw new Error(`no IDL type ${name}`)
  const layout = IdlCoder.typeDefLayout({
    typeDef,
    types: program.idl.types ?? [],
  })
  const buffer = Buffer.alloc(FIXTURE_BUFFER_BYTES)
  const length = layout.encode(value, buffer)
  return Buffer.concat([
    accountsCoder.accountDiscriminator(name),
    buffer.subarray(0, length),
  ])
}

const configAccountData = async (
  parameters: ConfigParameters,
): Promise<Buffer> => {
  const config = toPoolConfig(parameters)
  const padding = Array.from(
    { length: STORED_CURVE_POINTS - config.curve.length },
    () => ({ sqrtPrice: new BN(0), liquidity: new BN(0) }),
  )
  return encodeAccount(DbcAccount.PoolConfig, {
    ...config,
    curve: [...config.curve, ...padding],
  })
}

const poolAccountData = async (
  parameters: ConfigParameters,
  configAddress: PublicKey,
): Promise<Buffer> => {
  const pool = toInitialPool(parameters)
  return encodeAccount(DbcAccount.VirtualPool, {
    poolState: { ...pool.poolState, config: configAddress },
  })
}

const account = (
  data: Buffer,
  owner = DYNAMIC_BONDING_CURVE_PROGRAM_ID,
): AccountInfo<Buffer> => ({
  data,
  owner,
  lamports: 1,
  executable: false,
  rentEpoch: 0,
})

/** A connection whose account reads are answered from `accounts`. */
const withAccounts = (accounts: Map<string, AccountInfo<Buffer>>) => {
  const spy = vi
    .spyOn(connection, 'getAccountInfo')
    .mockImplementation(
      async (address) => accounts.get(address.toBase58()) ?? null,
    )
  return { connection, spy }
}

const configs = [
  ...LAUNCH_PRESETS.map((p) => [p.id, p.config] as const),
  ...Object.values(CurveShape).map(
    (s) => [s, withCurve(DEFAULT_LAUNCH_CONFIG, defaultCurve(s))] as const,
  ),
]

describe('loadOnChainConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each(configs)(
    '%s simulates exactly like the config it was created from',
    async (_, config) => {
      const parameters = compile(config)
      const address = Keypair.generate().publicKey
      const { connection: c } = withAccounts(
        new Map([
          [address.toBase58(), account(await configAccountData(parameters))],
        ]),
      )

      const result = await loadOnChainConfig(
        c,
        SolanaNetwork.Devnet,
        address.toBase58(),
      )
      if (!result.ok) throw new Error(result.rejection)
      for (const scenario of [
        DEFAULT_SCENARIO,
        SCENARIO_PRESETS[ScenarioPresetId.Hype],
      ]) {
        expect(scenarioMetrics(result.loaded.parameters, scenario)).toEqual(
          scenarioMetrics(parameters, scenario),
        )
      }
    },
  )

  it('follows a pool address to the config it was launched with', async () => {
    const parameters = compile(DEFAULT_LAUNCH_CONFIG)
    const configAddress = Keypair.generate().publicKey
    const poolAddress = Keypair.generate().publicKey
    const { connection: c } = withAccounts(
      new Map([
        [
          configAddress.toBase58(),
          account(await configAccountData(parameters)),
        ],
        [
          poolAddress.toBase58(),
          account(await poolAccountData(parameters, configAddress)),
        ],
      ]),
    )

    const result = await loadOnChainConfig(
      c,
      SolanaNetwork.Devnet,
      `  ${poolAddress.toBase58()}  `,
    )
    expect(result).toMatchObject({
      ok: true,
      loaded: {
        configAddress: configAddress.toBase58(),
        poolAddress: poolAddress.toBase58(),
      },
    })
  })

  it('refuses text that is not an address without touching the network', async () => {
    const { connection: c, spy } = withAccounts(new Map())
    for (const input of ['', 'hello', 'x'.repeat(200), '0OIl']) {
      expect(await loadOnChainConfig(c, SolanaNetwork.Devnet, input)).toEqual({
        ok: false,
        rejection: LoadRejection.NotAnAddress,
      })
    }
    expect(spy).not.toHaveBeenCalled()
  })

  it('refuses a missing account', async () => {
    const { connection: c } = withAccounts(new Map())
    expect(
      await loadOnChainConfig(
        c,
        SolanaNetwork.Devnet,
        Keypair.generate().publicKey.toBase58(),
      ),
    ).toEqual({
      ok: false,
      rejection: LoadRejection.NotFound,
    })
  })

  it('refuses an account the DBC program does not own, even with config-shaped data', async () => {
    const address = Keypair.generate().publicKey
    const data = await configAccountData(compile(DEFAULT_LAUNCH_CONFIG))
    const { connection: c } = withAccounts(
      new Map([
        [address.toBase58(), account(data, Keypair.generate().publicKey)],
      ]),
    )
    expect(
      await loadOnChainConfig(c, SolanaNetwork.Devnet, address.toBase58()),
    ).toEqual({
      ok: false,
      rejection: LoadRejection.NotDbcAccount,
    })
  })

  it('refuses a DBC account that is neither a config nor a pool', async () => {
    const address = Keypair.generate().publicKey
    const { connection: c } = withAccounts(
      new Map([[address.toBase58(), account(Buffer.alloc(64, 7))]]),
    )
    expect(
      await loadOnChainConfig(c, SolanaNetwork.Devnet, address.toBase58()),
    ).toEqual({
      ok: false,
      rejection: LoadRejection.NotAConfigOrPool,
    })
  })

  it('reports an RPC failure as a network error', async () => {
    vi.spyOn(connection, 'getAccountInfo').mockRejectedValue(
      new Error('429 Too Many Requests'),
    )
    expect(
      await loadOnChainConfig(
        connection,
        SolanaNetwork.Devnet,
        Keypair.generate().publicKey.toBase58(),
      ),
    ).toMatchObject({
      ok: false,
      rejection: LoadRejection.NetworkError,
    })
  })
})
