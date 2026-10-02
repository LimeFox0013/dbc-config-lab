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
import type { SolanaNetwork } from '../../core/config-deploy'
import { fromPoolConfig } from '../../core/onchain-config'
import { errorMessage } from '../../core/shared'
import { DbcAccount, LoadRejection, MAX_ADDRESS_LENGTH } from './constants'
import type { LoadResult } from './types'

export { LoadRejection, MAX_ADDRESS_LENGTH } from './constants'
export type { LoadResult, OnChainConfig } from './types'

const parseAddress = (raw: string): PublicKey | null => {
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_ADDRESS_LENGTH) return null
  try {
    return new PublicKey(trimmed)
  } catch {
    return null
  }
}

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

/**
 * Loads a DBC config from its address, or from the address of a pool launched with it.
 * Read-only: one or two account reads over the public RPC, no wallet involved.
 */
export const loadOnChainConfig = async (
  connection: Connection,
  network: SolanaNetwork,
  rawAddress: string,
): Promise<LoadResult> => {
  const address = parseAddress(rawAddress)
  if (!address) return { ok: false, rejection: LoadRejection.NotAnAddress }

  const first = await readDbcAccount(connection, address)
  if (!first.ok) return first
  if (first.account.kind === DbcAccount.PoolConfig) {
    return {
      ok: true,
      loaded: {
        configAddress: address.toBase58(),
        network,
        parameters: fromPoolConfig(first.account.config),
      },
    }
  }

  const configAddress = first.account.pool.poolState.config
  const second = await readDbcAccount(connection, configAddress)
  if (!second.ok) return second
  if (second.account.kind !== DbcAccount.PoolConfig)
    return { ok: false, rejection: LoadRejection.NotAConfigOrPool }
  return {
    ok: true,
    loaded: {
      configAddress: configAddress.toBase58(),
      poolAddress: address.toBase58(),
      network,
      parameters: fromPoolConfig(second.account.config),
    },
  }
}
