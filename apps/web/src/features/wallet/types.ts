import type { SolanaSignAndSendTransactionFeature } from '@solana/wallet-standard-features'
import type { WalletWithFeatures } from '@wallet-standard/base'
import type { StandardConnectFeature } from '@wallet-standard/features'

/** A Wallet Standard wallet able to connect and to sign-and-send Solana transactions. */
export type DeployWallet = WalletWithFeatures<
  StandardConnectFeature & SolanaSignAndSendTransactionFeature
>
