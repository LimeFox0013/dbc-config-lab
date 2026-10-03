import { PublicKey } from '@solana/web3.js'
import type { Commitment, Connection, Keypair } from '@solana/web3.js'
import {
  deriveFeeVaultPdaAddress,
  DYNAMIC_FEE_SHARING_PROGRAM_ID,
  DynamicFeeSharingClient,
  getTokenProgram,
  TokenType,
} from '@meteora-ag/dynamic-fee-sharing-sdk'
import {
  ROYALTY_RECIPIENT_SLOTS,
  ROYALTY_TOTAL_SHARES,
  VAULT_USER_SIZE,
  VAULT_USERS_OFFSET,
} from './constants'
import type { PresetRoyalty, RoyaltySplit, RoyaltyVault } from './types'

export {
  ROYALTY_PERCENT_LIMITS,
  ROYALTY_TOTAL_SHARES,
  RoyaltyRejection,
} from './constants'
export type { PresetRoyalty, RoyaltySplit, RoyaltyVault } from './types'
export { royaltyRejection } from './utils'

/**
 * The fee-sharing vault a royalty config's fees go to, and the instruction that creates it.
 * The vault is derived from the config's own address and signed for by its one-off key, so
 * it exists only if created alongside that config. Recipient 0 is the deployer.
 */
export const royaltyVault = async (
  connection: Connection,
  request: {
    configKey: Keypair
    quoteMint: PublicKey
    deployer: PublicKey
    royalty: PresetRoyalty
    commitment: Commitment
  },
): Promise<RoyaltyVault> => {
  const { configKey, quoteMint, deployer, royalty, commitment } = request
  const author = new PublicKey(royalty.author)
  const deployerPercent = ROYALTY_TOTAL_SHARES - royalty.sharePercent
  const transaction = await new DynamicFeeSharingClient(
    connection,
    commitment,
  ).createFeeVaultPda({
    base: configKey.publicKey,
    tokenMint: quoteMint,
    tokenProgram: getTokenProgram(TokenType.SPL),
    owner: deployer,
    payer: deployer,
    userShare: [
      { address: deployer, share: deployerPercent },
      { address: author, share: royalty.sharePercent },
    ],
  })
  const vault = deriveFeeVaultPdaAddress(configKey.publicKey, quoteMint)
  return {
    vault,
    instructions: transaction.instructions,
    split: {
      vault: vault.toBase58(),
      deployer: deployer.toBase58(),
      author: royalty.author,
      authorPercent: royalty.sharePercent,
      deployerPercent,
    },
  }
}

/**
 * The royalty vaults `recipient` is paid by, as deployer or as author. The slots are read
 * one after the other: the public RPC limits large account scans run side by side.
 */
export const royaltyVaultsOf = async (
  connection: Connection,
  recipient: PublicKey,
  commitment: Commitment,
): Promise<PublicKey[]> => {
  const { program } = new DynamicFeeSharingClient(connection, commitment)
  const found: PublicKey[] = []
  for (const slot of ROYALTY_RECIPIENT_SLOTS) {
    const vaults = await program.account.feeVault.all([
      {
        memcmp: {
          offset: VAULT_USERS_OFFSET + slot * VAULT_USER_SIZE,
          bytes: recipient.toBase58(),
        },
      },
    ])
    found.push(...vaults.map((v) => v.publicKey))
  }
  return found
}

/**
 * The split behind a fee claimer, when that fee claimer is a royalty vault — read from
 * chain, so a launch page shows who really earns its fees. Null for an ordinary wallet.
 */
export const readRoyaltySplit = async (
  connection: Connection,
  feeClaimer: PublicKey,
  commitment: Commitment,
): Promise<RoyaltySplit | null> => {
  const info = await connection.getAccountInfo(feeClaimer, commitment)
  if (!info || !info.owner.equals(DYNAMIC_FEE_SHARING_PROGRAM_ID)) return null
  const vault = await new DynamicFeeSharingClient(
    connection,
    commitment,
  ).getFeeVault(feeClaimer)
  const recipients = vault.users.filter(
    (user) => !user.address.equals(PublicKey.default),
  )
  // Only a two-way split reads as operator and author; anything else is shown as a plain wallet.
  if (recipients.length !== ROYALTY_RECIPIENT_SLOTS.length) return null
  const [deployer, author] = ROYALTY_RECIPIENT_SLOTS.map(
    (slot) => vault.users[slot],
  )
  if (!deployer || !author) return null
  const total = deployer.share + author.share
  return {
    vault: feeClaimer.toBase58(),
    deployer: deployer.address.toBase58(),
    author: author.address.toBase58(),
    authorPercent: (author.share * ROYALTY_TOTAL_SHARES) / total,
    deployerPercent: (deployer.share * ROYALTY_TOTAL_SHARES) / total,
  }
}
