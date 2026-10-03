import BN from 'bn.js'
import { PublicKey } from '@solana/web3.js'
import type { AccountInfo, Connection } from '@solana/web3.js'
import {
  CpAmm,
  derivePositionAddress,
  getUnClaimLpFee,
} from '@meteora-ag/cp-amm-sdk'
import type { PoolState, PositionState } from '@meteora-ag/cp-amm-sdk'
import { ACCOUNTS_PER_READ, chunks, evenSample } from '../shared'
import { CpAmmAccount, POSITION_NFT_PROGRAM } from './constants'
import type { HeldPositionFees } from './types'
import { nftMintsOf } from './utils'

/**
 * The quote-token fees earned by the graduated-pool positions `owner` holds — what the DBC
 * migration gives a config's fee claimer — claimed so far plus pending, per position. Reads
 * every position up to `limit`, an even sample beyond it. Read-only.
 */
export const heldPositionFees = async (
  connection: Connection,
  owner: PublicKey,
  quoteMint: PublicKey,
  limit: number,
  pause: () => Promise<void> = () => Promise.resolve(),
): Promise<HeldPositionFees> => {
  // The program's own coder: camel-cased fields, as the SDK's state types and fee math expect.
  const coder = new CpAmm(connection)._program.coder
  const readMany = async (
    keys: PublicKey[],
  ): Promise<(AccountInfo<Buffer> | null)[]> => {
    const out: (AccountInfo<Buffer> | null)[] = []
    for (const batch of chunks(keys, ACCOUNTS_PER_READ)) {
      await pause()
      out.push(...(await connection.getMultipleAccountsInfo(batch)))
    }
    return out
  }
  const decodeAll = <T>(
    infos: (AccountInfo<Buffer> | null)[],
    name: CpAmmAccount,
  ): (T | null)[] =>
    infos.map((info) => {
      if (!info) return null
      try {
        const decoded: T = coder.accounts.decode(name, info.data)
        return decoded
      } catch {
        // An NFT that is not a DAMM v2 position.
        return null
      }
    })

  await pause()
  const accounts = await connection.getParsedTokenAccountsByOwner(owner, {
    programId: POSITION_NFT_PROGRAM,
  })
  const mints = nftMintsOf(accounts.value)
  const sampled = evenSample(mints, limit)
  const positions = decodeAll<PositionState>(
    await readMany(sampled.map(derivePositionAddress)),
    CpAmmAccount.Position,
  ).filter((position): position is PositionState => position !== null)
  const poolKeys = [...new Set(positions.map((p) => p.pool.toBase58()))].map(
    (key) => new PublicKey(key),
  )
  const pools = decodeAll<PoolState>(
    await readMany(poolKeys),
    CpAmmAccount.Pool,
  )
  const poolOf = new Map(
    poolKeys.flatMap((key, i) => {
      const pool = pools[i]
      return pool ? [[key.toBase58(), pool] as const] : []
    }),
  )
  return {
    held: mints.length,
    read: sampled.length,
    quoteFees: positions.flatMap((position) => {
      const pool = poolOf.get(position.pool.toBase58())
      if (!pool || !pool.tokenBMint.equals(quoteMint)) return []
      return [
        position.metrics.totalClaimedBFee.add(
          new BN(getUnClaimLpFee(pool, position).feeTokenB),
        ),
      ]
    }),
  }
}
