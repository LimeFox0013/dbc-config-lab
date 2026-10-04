import { PublicKey } from '@solana/web3.js'
import type { Connection } from '@solana/web3.js'
import {
  createDbcProgram,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type {
  PoolConfig,
  VirtualPool,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { fromPoolConfig } from '../../core/onchain-config'
import { quoteTokenOfMint } from '../../core/quote-token'
import { errorMessage, parseAddress } from '../../core/shared'
import { DbcAccount, LoadRejection } from './constants'
import type { LoadResult, ReadResult } from './types'
import type { SolanaNetwork } from '../../core/shared'

type Account =
  | { kind: DbcAccount.PoolConfig; config: PoolConfig }
  | { kind: DbcAccount.VirtualPool; pool: VirtualPool }

/** Decodes an account's data as a DBC config or pool; the IDL discriminator decides which. */
const decode = (connection: Connection, data: Buffer): Account | null => {
  const { program } = createDbcProgram(connection)
  try {
    const config: PoolConfig = program.coder.accounts.decode(
      DbcAccount.PoolConfig,
      data,
    )
    return { kind: DbcAccount.PoolConfig, config }
  } catch {
    try {
      const pool: VirtualPool = program.coder.accounts.decode(
        DbcAccount.VirtualPool,
        data,
      )
      return { kind: DbcAccount.VirtualPool, pool }
    } catch {
      return null
    }
  }
}

/** Reads one DBC-owned account, refusing anything the DBC program does not own. */
const readDbcAccount = async (
  connection: Connection,
  address: PublicKey,
): Promise<
  | { ok: true; account: Account }
  | { ok: false; rejection: LoadRejection; detail?: string }
> => {
  let info: Awaited<ReturnType<Connection['getAccountInfo']>>
  try {
    info = await connection.getAccountInfo(address)
  } catch (error) {
    return {
      ok: false,
      rejection: LoadRejection.NetworkError,
      detail: errorMessage(error),
    }
  }
  if (!info) return { ok: false, rejection: LoadRejection.NotFound }
  if (!info.owner.equals(DYNAMIC_BONDING_CURVE_PROGRAM_ID))
    return { ok: false, rejection: LoadRejection.NotDbcAccount }
  const account = decode(connection, info.data)
  return account
    ? { ok: true, account }
    : { ok: false, rejection: LoadRejection.NotAConfigOrPool }
}

/** A decoded config as read from chain, whatever token it is priced in. */
const readConfig = (
  config: PoolConfig,
  network: SolanaNetwork,
  configAddress: PublicKey,
  poolAddress?: PublicKey,
): ReadResult => ({
  ok: true,
  read: {
    configAddress: configAddress.toBase58(),
    ...(poolAddress ? { poolAddress: poolAddress.toBase58() } : {}),
    network,
    feeClaimer: config.feeClaimer.toBase58(),
    parameters: fromPoolConfig(config),
    quoteMint: config.quoteMint.toBase58(),
  },
})

/**
 * Reads a DBC config from its address, or from the address of a pool launched with it,
 * in raw on-chain units. Read-only: one or two account reads over the public RPC.
 */
export const readOnChainConfig = async (
  connection: Connection,
  network: SolanaNetwork,
  rawAddress: string,
): Promise<ReadResult> => {
  const address = parseAddress(rawAddress)
  if (!address) return { ok: false, rejection: LoadRejection.NotAnAddress }

  const first = await readDbcAccount(connection, address)
  if (!first.ok) return first
  if (first.account.kind === DbcAccount.PoolConfig)
    return readConfig(first.account.config, network, address)

  const configAddress = first.account.pool.poolState.config
  const second = await readDbcAccount(connection, configAddress)
  if (!second.ok) return second
  if (second.account.kind !== DbcAccount.PoolConfig)
    return { ok: false, rejection: LoadRejection.NotAConfigOrPool }
  return readConfig(second.account.config, network, configAddress, address)
}

/**
 * Loads a DBC config for simulation: read from chain, then priced in its quote token. A
 * token the simulator cannot price is refused rather than simulated in the wrong units.
 */
export const loadOnChainConfig = async (
  connection: Connection,
  network: SolanaNetwork,
  rawAddress: string,
): Promise<LoadResult> => {
  const result = await readOnChainConfig(connection, network, rawAddress)
  if (!result.ok) return result
  const { quoteMint, ...read } = result.read
  const quoteToken = quoteTokenOfMint(quoteMint, network)
  return quoteToken
    ? { ok: true, loaded: { ...read, quoteToken } }
    : {
        ok: false,
        rejection: LoadRejection.UnsupportedQuoteToken,
        detail: quoteMint,
      }
}
