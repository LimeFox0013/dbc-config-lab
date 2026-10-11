import type { GetProgramAccountsFilter, PublicKey } from '@solana/web3.js'
import type { VirtualPool } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { DbcAccount } from './constants'
import type { DbcProgram } from './types'

/** A program-account filter keeping only accounts of one DBC type, matched by its discriminator. */
export const dbcAccountFilter = (
  program: DbcProgram,
  name: DbcAccount,
): GetProgramAccountsFilter => {
  const { bytes } = program.coder.accounts.memcmp(name)
  if (!bytes) throw new Error(`No discriminator for ${name}`)
  return { memcmp: { offset: 0, bytes } }
}

/** A program-account filter keeping only accounts that store `address` at `offset`. */
export const addressFilter = (
  offset: number,
  address: PublicKey,
): GetProgramAccountsFilter => ({
  memcmp: { offset, bytes: address.toBase58() },
})

/** A DBC pool account, or null when the decoder cannot read it (an older layout, say). */
export const decodeVirtualPool = (
  program: DbcProgram,
  data: Buffer,
): VirtualPool | null => {
  try {
    const pool: VirtualPool = program.coder.accounts.decode(
      DbcAccount.VirtualPool,
      data,
    )
    return pool
  } catch {
    return null
  }
}
