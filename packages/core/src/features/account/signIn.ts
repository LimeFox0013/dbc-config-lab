import bs58 from 'bs58'
import { SolanaSignMessage } from '@solana/wallet-standard-features'
import type { SolanaSignMessageFeature } from '@solana/wallet-standard-features'
import type { Wallet, WalletWithFeatures } from '@wallet-standard/base'
import { errorMessage } from '../../core/shared'
import type { ConnectedWallet } from '../wallet'
import type { AccountClient } from './client'
import { SignInStop } from './constants'
import type { SignInResult } from './types'

export type SignMessageWallet = WalletWithFeatures<SolanaSignMessageFeature>

export const canSignMessage = (wallet: Wallet): wallet is SignMessageWallet =>
  SolanaSignMessage in wallet.features

/**
 * `wallet-sign-in`: asks the service for a challenge, has the connected wallet sign that
 * exact message (Wallet Standard `solana:signMessage`), and trades the base58 signature
 * for a session. The service sets the session cookie; nothing here stores it.
 */
export const signInWithWallet = async (
  client: AccountClient,
  connected: ConnectedWallet,
): Promise<SignInResult> => {
  const { wallet, account, owner } = connected
  if (!canSignMessage(wallet))
    return { ok: false, stop: SignInStop.NoSignMessage, detail: null }
  const challenge = await client.challenge(owner.toBase58())
  if (!challenge.ok) return challenge
  let signature: Uint8Array
  try {
    const [output] = await wallet.features[SolanaSignMessage].signMessage({
      account,
      message: new TextEncoder().encode(challenge.value.message),
    })
    if (!output)
      return { ok: false, stop: SignInStop.WalletFailed, detail: null }
    signature = output.signature
  } catch (cause) {
    return {
      ok: false,
      stop: SignInStop.WalletFailed,
      detail: errorMessage(cause),
    }
  }
  return client.signIn(challenge.value.message, bs58.encode(signature))
}
