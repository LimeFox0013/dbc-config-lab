import { SolanaSignAndSendTransaction } from '@solana/wallet-standard-features'
import type { Wallet, WalletAccount } from '@wallet-standard/base'
import { StandardConnect } from '@wallet-standard/features'
import type { SolanaChain } from '../../core/config-deploy'
import type { DeployWallet } from './types'

export const isDeployCapable = (wallet: Wallet): wallet is DeployWallet =>
  StandardConnect in wallet.features &&
  SolanaSignAndSendTransaction in wallet.features

/** The account that can act on `chain` — never just the first account the wallet returns. */
export const accountForChain = (
  accounts: readonly WalletAccount[],
  chain: SolanaChain,
): WalletAccount | undefined =>
  accounts.find((account) => account.chains.includes(chain))
