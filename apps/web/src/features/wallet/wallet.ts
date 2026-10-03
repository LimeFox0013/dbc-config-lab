import bs58 from 'bs58'
import { PublicKey } from '@solana/web3.js'
import type { Connection } from '@solana/web3.js'
import { getWallets } from '@wallet-standard/app'
import { SolanaSignAndSendTransaction } from '@solana/wallet-standard-features'
import { StandardConnect } from '@wallet-standard/features'
import { CHAIN_BY_NETWORK } from '../../core/config-deploy'
import type { PreparedTransaction } from '../../core/config-deploy'
import type { ConnectedWallet, DeployWallet } from './types'
import { accountForChain, isDeployCapable } from './utils'
import type { SolanaNetwork } from '../../core/shared'
import { WALLET_ERRORS } from './constants'

export const listDeployWallets = (): DeployWallet[] =>
  getWallets().get().filter(isDeployCapable)

/** Calls `listener` whenever a wallet registers or unregisters; returns the unsubscribe. */
export const onWalletsChanged = (listener: () => void): (() => void) => {
  const wallets = getWallets()
  const offRegister = wallets.on('register', listener)
  const offUnregister = wallets.on('unregister', listener)
  return () => {
    offRegister()
    offUnregister()
  }
}

export const connectWallet = async (
  wallet: DeployWallet,
  network: SolanaNetwork,
): Promise<ConnectedWallet> => {
  const { accounts } = await wallet.features[StandardConnect].connect()
  const account = accountForChain(accounts, CHAIN_BY_NETWORK[network])
  if (!account) throw new Error(WALLET_ERRORS.noAccount(wallet.name, network))
  return { wallet, account, owner: new PublicKey(account.publicKey) }
}

/** Has the wallet add the payer signature and submit, then waits for confirmation. */
export const signAndSendPrepared = async (
  connection: Connection,
  connected: ConnectedWallet,
  prepared: PreparedTransaction,
  network: SolanaNetwork,
): Promise<string> => {
  const { transaction } = prepared
  const [output] = await connected.wallet.features[
    SolanaSignAndSendTransaction
  ].signAndSendTransaction({
    account: connected.account,
    chain: CHAIN_BY_NETWORK[network],
    transaction: transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }),
  })
  if (!output) throw new Error(WALLET_ERRORS.noSignature)
  const signature = bs58.encode(output.signature)
  const blockhash = transaction.recentBlockhash
  if (!blockhash) throw new Error(WALLET_ERRORS.noBlockhash)

  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash,
      lastValidBlockHeight: prepared.lastValidBlockHeight,
    },
    'confirmed',
  )
  if (confirmation.value.err)
    throw new Error(WALLET_ERRORS.failed(confirmation.value.err))
  return signature
}
