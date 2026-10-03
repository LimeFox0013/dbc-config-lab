import type { PublicKey, TransactionInstruction } from '@solana/web3.js'

/** What a preset's author earns from every launchpad deployed from it. */
export interface PresetRoyalty {
  /** The author's wallet, which claims their share itself. */
  author: string
  /** The author's share of the launchpad's fees, in whole percent. */
  sharePercent: number
}

/** The split a deployment sets, as shown before signing. */
export interface RoyaltySplit {
  /** Meteora fee-sharing vault that receives and splits the launchpad's fees. */
  vault: string
  /** The launchpad's operator: the wallet that deployed the config. */
  deployer: string
  author: string
  authorPercent: number
  deployerPercent: number
}

/** The vault's creation, to be placed before the config's in the same transaction. */
export interface RoyaltyVault {
  vault: PublicKey
  instructions: TransactionInstruction[]
  split: RoyaltySplit
}
