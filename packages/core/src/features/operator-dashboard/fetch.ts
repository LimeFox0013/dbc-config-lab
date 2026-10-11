import { PublicKey } from '@solana/web3.js'
import type { Connection, GetProgramAccountsFilter } from '@solana/web3.js'
import {
  createDbcProgram,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { PoolConfig } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { heldPositionFees } from '../../core/graduated-positions'
import { partnerLiquidityPercent } from '../../core/migrated-pool'
import {
  fromPoolConfig,
  POOL_CONFIG_LAYOUT,
  VIRTUAL_POOL_LAYOUT,
} from '../../core/onchain-config'
import { quoteTokenOfMint, solFromQuoteUnits } from '../../core/quote-token'
import { errorMessage, parseAddress } from '../../core/shared'
import type { SolanaNetwork } from '../../core/shared'
import {
  addressFilter,
  DbcAccount,
  dbcAccountFilter,
  decodeVirtualPool,
} from '../onchain-config'
import { OperatorRejection, POSITION_READ_LIMIT } from './constants'
import type { OperatorPositions, OperatorResult } from './types'
import { operatorConfig, scaledPositionFees } from './utils'

/**
 * Everything `address` earns as a launchpad fee wallet: each config it is fee claimer of,
 * read from all of the config's pools, and the graduated-pool positions it holds in the
 * quote tokens of the configs that give it graduation liquidity. Read-only, public RPC.
 */
export const fetchOperatorReport = async (
  connection: Connection,
  network: SolanaNetwork,
  address: string,
): Promise<OperatorResult> => {
  const owner = parseAddress(address)
  if (!owner) return { ok: false, rejection: OperatorRejection.InvalidAddress }
  const { program } = createDbcProgram(connection)
  const discriminator = (name: DbcAccount): GetProgramAccountsFilter =>
    dbcAccountFilter(program, name)
  const field = addressFilter
  const accounts = (filters: GetProgramAccountsFilter[]) =>
    connection.getProgramAccounts(DYNAMIC_BONDING_CURVE_PROGRAM_ID, { filters })

  try {
    const configAccounts = await accounts([
      discriminator(DbcAccount.PoolConfig),
      field(POOL_CONFIG_LAYOUT.feeClaimer, owner),
    ])
    if (configAccounts.length === 0)
      return { ok: false, rejection: OperatorRejection.NoConfigs }
    const decoded = configAccounts.map(({ pubkey, account }) => {
      const config: PoolConfig = program.coder.accounts.decode(
        DbcAccount.PoolConfig,
        account.data,
      )
      return { pubkey, config, parameters: fromPoolConfig(config) }
    })
    const configs = await Promise.all(
      decoded.map(async ({ pubkey, config, parameters }) => {
        const pools = (
          await accounts([
            discriminator(DbcAccount.VirtualPool),
            field(VIRTUAL_POOL_LAYOUT.config, pubkey),
          ])
        ).flatMap(({ account }) => {
          // A pool this decoder cannot read (an older layout, say) is left out.
          const pool = decodeVirtualPool(program, account.data)
          return pool ? [pool] : []
        })
        return operatorConfig(
          pubkey.toBase58(),
          pools,
          quoteTokenOfMint(config.quoteMint.toBase58(), network),
          parameters,
        )
      }),
    )
    // The fee wallet holds graduated-pool positions only for configs that give it liquidity.
    const quoteMints = [
      ...new Set(
        decoded
          .filter(({ config }) => partnerLiquidityPercent(config) > 0)
          .map(({ config }) => config.quoteMint.toBase58()),
      ),
    ]
    const positions = (
      await Promise.all(
        quoteMints.map(async (mint): Promise<OperatorPositions[]> => {
          const quoteToken = quoteTokenOfMint(mint, network)
          if (!quoteToken) return []
          const held = await heldPositionFees(
            connection,
            owner,
            new PublicKey(mint),
            POSITION_READ_LIMIT,
          )
          const readSol = held.quoteFees.reduce(
            (sum, fees) => sum + solFromQuoteUnits(fees, quoteToken),
            0,
          )
          return [
            {
              quoteToken,
              held: held.held,
              read: held.read,
              feesSol: scaledPositionFees(readSol, held.read, held.held),
            },
          ]
        }),
      )
    ).flat()
    return {
      ok: true,
      report: {
        owner: owner.toBase58(),
        configs: configs.sort((a, b) => b.launches - a.launches),
        positions,
        readAt: new Date().toISOString(),
      },
    }
  } catch (error) {
    return {
      ok: false,
      rejection: OperatorRejection.NetworkError,
      detail: errorMessage(error),
    }
  }
}
