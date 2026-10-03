import { afterEach, describe, expect, it, vi } from 'vitest'
import { Keypair, PublicKey } from '@solana/web3.js'
import type { AccountInfo } from '@solana/web3.js'
import { DYNAMIC_BONDING_CURVE_PROGRAM_ID } from '@meteora-ag/dynamic-bonding-curve-sdk'
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
import {
  DEFAULT_SCENARIO,
  scenarioMetrics,
  SCENARIO_PRESETS,
  ScenarioPresetId,
} from '../../core/sniper-scenario'
import { loadOnChainConfig, LoadRejection } from '.'
import { QUOTE_TOKENS, QuoteToken } from '../../core/quote-token'
import { configAccountData, poolAccountData } from '../../testing/dbc-accounts'

const compile = (config: LaunchConfig): ConfigParameters => {
  const compiled = compileLaunchConfig(config)
  if (!compiled.ok) throw new Error(compiled.reason)
  return compiled.parameters
}

const connection = connectionFor(SolanaNetwork.Devnet)

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
        new Map([[address.toBase58(), account(configAccountData(parameters))]]),
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
        expect(
          scenarioMetrics(
            result.loaded.parameters,
            scenario,
            result.loaded.quoteToken,
          ),
        ).toEqual(scenarioMetrics(parameters, scenario, QuoteToken.Sol))
      }
    },
  )

  it('follows a pool address to the config it was launched with', async () => {
    const parameters = compile(DEFAULT_LAUNCH_CONFIG)
    const configAddress = Keypair.generate().publicKey
    const poolAddress = Keypair.generate().publicKey
    const { connection: c } = withAccounts(
      new Map([
        [configAddress.toBase58(), account(configAccountData(parameters))],
        [
          poolAddress.toBase58(),
          account(poolAccountData(parameters, configAddress)),
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

  it('simulates a USDC config in USDC, not as if it were priced in SOL', async () => {
    const usdc = {
      ...DEFAULT_LAUNCH_CONFIG,
      quoteToken: QuoteToken.Usdc,
      migrationQuoteThreshold: 15_000,
    }
    const parameters = compile(usdc)
    const address = Keypair.generate().publicKey
    const usdcMint = new PublicKey(
      QUOTE_TOKENS[QuoteToken.Usdc].mints[SolanaNetwork.Mainnet],
    )
    const { connection: c } = withAccounts(
      new Map([
        [address.toBase58(), account(configAccountData(parameters, usdcMint))],
      ]),
    )

    const result = await loadOnChainConfig(
      c,
      SolanaNetwork.Mainnet,
      address.toBase58(),
    )
    if (!result.ok) throw new Error(result.rejection)
    expect(result.loaded.quoteToken).toBe(QuoteToken.Usdc)
    expect(
      scenarioMetrics(
        result.loaded.parameters,
        DEFAULT_SCENARIO,
        result.loaded.quoteToken,
      ),
    ).toEqual(scenarioMetrics(parameters, DEFAULT_SCENARIO, QuoteToken.Usdc))
  })

  it('refuses a config priced in a token it cannot simulate, naming the mint', async () => {
    const address = Keypair.generate().publicKey
    const otherMint = Keypair.generate().publicKey
    const { connection: c } = withAccounts(
      new Map([
        [
          address.toBase58(),
          account(configAccountData(compile(DEFAULT_LAUNCH_CONFIG), otherMint)),
        ],
      ]),
    )
    expect(
      await loadOnChainConfig(c, SolanaNetwork.Devnet, address.toBase58()),
    ).toEqual({
      ok: false,
      rejection: LoadRejection.UnsupportedQuoteToken,
      detail: otherMint.toBase58(),
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
    const data = configAccountData(compile(DEFAULT_LAUNCH_CONFIG))
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
