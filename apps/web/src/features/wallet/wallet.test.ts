import { describe, expect, it } from 'vitest'
import type { Wallet, WalletAccount } from '@wallet-standard/base'
import { SolanaChain } from '../../core/config-deploy'
import { accountForChain, isDeployCapable } from '.'

const account = (chains: WalletAccount['chains']): WalletAccount => ({
  address: 'addr',
  publicKey: new Uint8Array(32),
  chains,
  features: [],
})

const wallet = (features: Wallet['features']): Wallet => ({
  version: '1.0.0',
  name: 'Test',
  icon: 'data:image/svg+xml;base64,',
  chains: [SolanaChain.Devnet],
  features,
  accounts: [],
})

describe('isDeployCapable', () => {
  it('requires both connect and sign-and-send', () => {
    expect(isDeployCapable(wallet({ 'standard:connect': {} }))).toBe(false)
    expect(
      isDeployCapable(
        wallet({ 'standard:connect': {}, 'solana:signAndSendTransaction': {} }),
      ),
    ).toBe(true)
  })
})

describe('accountForChain', () => {
  it('picks the account on the requested chain, not the first one', () => {
    const mainnet = account([SolanaChain.Mainnet])
    const devnet = account([SolanaChain.Devnet])
    expect(accountForChain([mainnet, devnet], SolanaChain.Devnet)).toBe(devnet)
  })

  it('finds nothing when no account is on the chain', () => {
    expect(
      accountForChain([account([SolanaChain.Mainnet])], SolanaChain.Devnet),
    ).toBeUndefined()
  })
})
