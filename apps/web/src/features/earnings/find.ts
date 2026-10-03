import { PublicKey } from '@solana/web3.js'
import type { Connection, GetProgramAccountsFilter } from '@solana/web3.js'
import {
  createDbcProgram,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type {
  PoolConfig,
  VirtualPool,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { FeeRole } from '../../core/fee-claim'
import { errorMessage } from '../../core/shared'
import type { SolanaNetwork } from '../../core/shared'
import { DbcAccount } from '../onchain-config'
import { EarningsRejection, MAX_EARNINGS_ROWS } from './constants'
import type { EarningsResult, PoolFees } from './types'
import { byValue, earningsRows } from './utils'
import {
  POOL_CONFIG_LAYOUT,
  VIRTUAL_POOL_LAYOUT,
} from '../../core/onchain-config'

const poolFees = (pool: string, account: VirtualPool): PoolFees => {
  const state = account.poolState
  return {
    pool,
    config: state.config.toBase58(),
    sqrtPrice: state.sqrtPrice,
    partnerQuoteFee: state.partnerQuoteFee,
    partnerBaseFee: state.partnerBaseFee,
    creatorQuoteFee: state.creatorQuoteFee,
    creatorBaseFee: state.creatorBaseFee,
  }
}

/**
 * Every pool on which `owner` has trading fees to claim: as fee claimer of the configs
 * the pools were launched with (partner), and as the pools' creator. Read-only, public
 * RPC; standard pools only (transfer-hook pools use another account type).
 */
export const findEarnings = async (
  connection: Connection,
  network: SolanaNetwork,
  owner: PublicKey,
): Promise<EarningsResult> => {
  const { program } = createDbcProgram(connection)
  const discriminator = (name: DbcAccount): GetProgramAccountsFilter => {
    const { bytes } = program.coder.accounts.memcmp(name)
    if (!bytes) throw new Error(`No discriminator for ${name}`)
    return { memcmp: { offset: 0, bytes } }
  }
  const field = (offset: number, key: PublicKey): GetProgramAccountsFilter => ({
    memcmp: { offset, bytes: key.toBase58() },
  })
  const accounts = (filters: GetProgramAccountsFilter[]) =>
    connection.getProgramAccounts(DYNAMIC_BONDING_CURVE_PROGRAM_ID, { filters })
  const decodePool = (pubkey: PublicKey, data: Buffer): PoolFees[] => {
    try {
      const pool: VirtualPool = program.coder.accounts.decode(
        DbcAccount.VirtualPool,
        data,
      )
      return [poolFees(pubkey.toBase58(), pool)]
    } catch {
      return []
    }
  }
  const decodeConfig = (data: Buffer): PoolConfig =>
    program.coder.accounts.decode(DbcAccount.PoolConfig, data)

  try {
    const [ownConfigs, createdPools] = await Promise.all([
      accounts([
        discriminator(DbcAccount.PoolConfig),
        field(POOL_CONFIG_LAYOUT.feeClaimer, owner),
      ]),
      accounts([
        discriminator(DbcAccount.VirtualPool),
        field(VIRTUAL_POOL_LAYOUT.creator, owner),
      ]),
    ])
    const partnerPools = (
      await Promise.all(
        ownConfigs.map((config) =>
          accounts([
            discriminator(DbcAccount.VirtualPool),
            field(VIRTUAL_POOL_LAYOUT.config, config.pubkey),
          ]),
        ),
      )
    ).flat()

    // Quote mints of every config involved: own configs are already read.
    const quoteMints = new Map(
      ownConfigs.map((c) => [
        c.pubkey.toBase58(),
        decodeConfig(c.account.data).quoteMint.toBase58(),
      ]),
    )
    const creatorFees = createdPools.flatMap((p) =>
      decodePool(p.pubkey, p.account.data),
    )
    const missing = [
      ...new Set(
        creatorFees.map((p) => p.config).filter((c) => !quoteMints.has(c)),
      ),
    ]
    const missingInfos = await connection.getMultipleAccountsInfo(
      missing.map((c) => new PublicKey(c)),
    )
    missingInfos.forEach((info, i) => {
      const address = missing[i]
      if (info && address)
        quoteMints.set(address, decodeConfig(info.data).quoteMint.toBase58())
    })

    const rows = [
      ...earningsRows(
        partnerPools.flatMap((p) => decodePool(p.pubkey, p.account.data)),
        FeeRole.Partner,
        (c) => quoteMints.get(c),
        network,
      ),
      ...earningsRows(
        creatorFees,
        FeeRole.Creator,
        (c) => quoteMints.get(c),
        network,
      ),
    ].sort(byValue)
    return {
      ok: true,
      earnings: {
        rows: rows.slice(0, MAX_EARNINGS_ROWS),
        totalRows: rows.length,
      },
    }
  } catch (error) {
    return {
      ok: false,
      rejection: EarningsRejection.NetworkError,
      detail: errorMessage(error),
    }
  }
}
