import { PublicKey } from '@solana/web3.js'
import type { Connection } from '@solana/web3.js'
import {
  createDbcProgram,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type {
  ConfigParameters,
  VirtualPool,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { QuoteToken } from '../../core/quote-token'
import {
  ACCOUNTS_PER_READ,
  chunks,
  errorMessage,
  evenSample,
} from '../../core/shared'
import { DbcAccount } from '../onchain-config'
import { POOL_SAMPLE_LIMIT, RealLaunchesRejection } from './constants'
import type { RealLaunchesResult } from './types'
import { curveTokensOf, poolRecord, summarizePools } from './utils'
import { VIRTUAL_POOL_LAYOUT } from '../../core/onchain-config'

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
    const discriminator = program.coder.accounts.memcmp(DbcAccount.VirtualPool)
    if (!discriminator.bytes) throw new Error('No pool account discriminator')
    const keys = await connection.getProgramAccounts(
      DYNAMIC_BONDING_CURVE_PROGRAM_ID,
      {
        dataSlice: { offset: 0, length: 0 },
        filters: [
          { memcmp: { offset: 0, bytes: discriminator.bytes } },
          {
            memcmp: {
              offset: VIRTUAL_POOL_LAYOUT.config,
              bytes: new PublicKey(configAddress).toBase58(),
            },
          },
        ],
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
      if (!info) return []
      try {
        const pool: VirtualPool = program.coder.accounts.decode(
          DbcAccount.VirtualPool,
          info.data,
        )
        return [
          poolRecord(
            pool,
            parameters.migrationQuoteThreshold,
            curveTokens,
            parameters.activationType,
          ),
        ]
      } catch {
        return []
      }
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
