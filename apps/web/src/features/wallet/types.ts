import type { Ref } from 'vue'
import type { PublicKey } from '@solana/web3.js'
import type { SolanaNetwork } from '../../core/shared'
import type { SolanaSignAndSendTransactionFeature } from '@solana/wallet-standard-features'
import type { WalletAccount, WalletWithFeatures } from '@wallet-standard/base'
import type { StandardConnectFeature } from '@wallet-standard/features'

/** A Wallet Standard wallet able to connect and to sign-and-send Solana transactions. */
export type DeployWallet = WalletWithFeatures<
  StandardConnectFeature & SolanaSignAndSendTransactionFeature
>

export interface ConnectedWallet {
  wallet: DeployWallet
  account: WalletAccount
  owner: PublicKey
}

/** The network, wallet and mainnet acknowledgement a signing flow reads from its screen. */
export interface WalletSessionRefs {
  network: Readonly<Ref<SolanaNetwork>>
  connected: Readonly<Ref<ConnectedWallet | null>>
  mainnetAcknowledged: Readonly<Ref<boolean>>
}
