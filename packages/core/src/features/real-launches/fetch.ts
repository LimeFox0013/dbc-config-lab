import bs58 from 'bs58'
import { PublicKey } from '@solana/web3.js'
import type { Connection, GetProgramAccountsFilter } from '@solana/web3.js'
import {
  createDbcProgram,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { QuoteToken } from '../../core/quote-token'
import {
  ACCOUNTS_PER_READ,
  chunks,
  errorMessage,
  evenSample,
} from '../../core/shared'
import {
  addressFilter,
  DbcAccount,
  dbcAccountFilter,
  decodeVirtualPool,
} from '../onchain-config'
import {
  MIGRATED_FLAG,
  POOL_SAMPLE_LIMIT,
  RealLaunchesRejection,
} from './constants'
import type { RealLaunchesResult } from './types'
import { curveTokensOf, poolRecord, summarizePools } from './utils'
import { VIRTUAL_POOL_LAYOUT } from '../../core/onchain-config'

/** Program-account filters for the DBC pools created with one config. */
const poolsOfConfig = (
  connection: Connection,
  configAddress: string,
): GetProgramAccountsFilter[] => {
  const { program } = createDbcProgram(connection)
  return [
    dbcAccountFilter(program, DbcAccount.VirtualPool),
    addressFilter(VIRTUAL_POOL_LAYOUT.config, new PublicKey(configAddress)),
  ]
}

/**
 * How many pools created with a config have graduated — every pool, not a
 * sample: the chain filters on the pool's migrated flag and returns addresses
 * only. Throws on a network error.
 */
export const countGraduatedPools = async (
  connection: Connection,
  configAddress: string,
): Promise<number> => {
  const keys = await connection.getProgramAccounts(
    DYNAMIC_BONDING_CURVE_PROGRAM_ID,
    {
      dataSlice: { offset: 0, length: 0 },
      filters: [
        ...poolsOfConfig(connection, configAddress),
        {
          memcmp: {
            offset: VIRTUAL_POOL_LAYOUT.isMigrated,
            bytes: bs58.encode(Uint8Array.from([MIGRATED_FLAG])),
          },
        },
      ],
    },
  )
  return keys.length
}

/**
 * How the real launches on a config went: finds every pool created with it (addresses
 * only), reads all of them or an evenly spread sample, and aggregates what they show.
 * Read-only, public RPC.
 */
export const fetchRealLaunches = async (
  connection: Connection,
  configAddress: string,
  parameters: ConfigParameters,
  quote: QuoteToken,
): Promise<RealLaunchesResult> => {
  const { program } = createDbcProgram(connection)
  try {
    const keys = await connection.getProgramAccounts(
      DYNAMIC_BONDING_CURVE_PROGRAM_ID,
      {
        dataSlice: { offset: 0, length: 0 },
        filters: poolsOfConfig(connection, configAddress),
      },
    )
    if (keys.length === 0)
      return { ok: false, rejection: RealLaunchesRejection.NoPools }

    const addresses = evenSample(
      keys
        .map((k) => ({ key: k.pubkey, text: k.pubkey.toBase58() }))
        .sort((a, b) => a.text.localeCompare(b.text))
        .map((k) => k.key),
      POOL_SAMPLE_LIMIT,
    )
    const accounts = (
      await Promise.all(
        chunks(addresses, ACCOUNTS_PER_READ).map((batch) =>
          connection.getMultipleAccountsInfo(batch),
        ),
      )
    ).flat()
    const curveTokens = curveTokensOf(parameters)
    // A pool the decoder cannot read (an older layout, say) is left out, not fatal.
    const records = accounts.flatMap((info) => {
      const pool = info && decodeVirtualPool(program, info.data)
      return pool
        ? [
            poolRecord(
              pool,
              parameters.migrationQuoteThreshold,
              curveTokens,
              parameters.activationType,
            ),
          ]
        : []
    })
    return {
      ok: true,
      launches: summarizePools(
        records,
        keys.length,
        parameters.migrationQuoteThreshold,
        quote,
      ),
    }
  } catch (error) {
    return {
      ok: false,
      rejection: RealLaunchesRejection.NetworkError,
      detail: errorMessage(error),
    }
  }
}
