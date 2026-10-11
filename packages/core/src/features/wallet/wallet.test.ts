import { describe, expect, it, vi } from 'vitest'
import { Keypair, Transaction } from '@solana/web3.js'
import type { Wallet, WalletAccount } from '@wallet-standard/base'
import { connectionFor, SolanaChain } from '../../core/config-deploy'
import { SolanaNetwork } from '../../core/shared'
import {
  accountForChain,
  connectWallet,
  isDeployCapable,
  signAndSendPrepared,
} from '.'
import type { ConnectedWallet, DeployWallet } from '.'

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

describe('connectWallet', () => {
  const owner = Keypair.generate().publicKey
  const onChain = (chains: WalletAccount['chains']): WalletAccount => ({
    address: owner.toBase58(),
    publicKey: owner.toBytes(),
    chains,
    features: [],
  })
  const deployWallet = (accounts: WalletAccount[]): DeployWallet => ({
    version: '1.0.0',
    name: 'Test',
    icon: 'data:image/svg+xml;base64,',
    chains: [SolanaChain.Devnet, SolanaChain.Mainnet],
    accounts,
    features: {
      'standard:connect': {
        version: '1.0.0',
        connect: async () => ({ accounts }),
      },
      'solana:signAndSendTransaction': {
        version: '1.0.0',
        supportedTransactionVersions: ['legacy'],
        signAndSendTransaction: async () => [],
      },
    },
  })

  it('connects the account on the network’s chain', async () => {
    const devnet = onChain([SolanaChain.Devnet])
    const connected = await connectWallet(
      deployWallet([onChain([SolanaChain.Mainnet]), devnet]),
      SolanaNetwork.Devnet,
    )
    expect(connected.account).toBe(devnet)
    expect(connected.owner.equals(owner)).toBe(true)
  })

  it('refuses a wallet with no account on that network', async () => {
    await expect(
      connectWallet(
        deployWallet([onChain([SolanaChain.Mainnet])]),
        SolanaNetwork.Devnet,
      ),
    ).rejects.toThrow('Test has no account for devnet')
  })
})

describe('signAndSendPrepared', () => {
  const owner = Keypair.generate().publicKey
  const account: WalletAccount = {
    address: owner.toBase58(),
    publicKey: owner.toBytes(),
    chains: [SolanaChain.Devnet],
    features: [],
  }
  const signature = new Uint8Array(64).fill(7)
  const connectedReturning = (
    outputs: { signature: Uint8Array }[],
  ): ConnectedWallet => ({
    account,
    owner,
    wallet: {
      version: '1.0.0',
      name: 'Test',
      icon: 'data:image/svg+xml;base64,',
      chains: [SolanaChain.Devnet],
      accounts: [account],
      features: {
        'standard:connect': {
          version: '1.0.0',
          connect: async () => ({ accounts: [account] }),
        },
        'solana:signAndSendTransaction': {
          version: '1.0.0',
          supportedTransactionVersions: ['legacy'],
          signAndSendTransaction: async () => outputs,
        },
      },
    },
  })
  const prepared = (blockhash: string | undefined) => {
    const transaction = new Transaction({ feePayer: owner })
    transaction.recentBlockhash = blockhash
    return { transaction, lastValidBlockHeight: 9 }
  }
  const blockhash = Keypair.generate().publicKey.toBase58()

  it('returns the wallet’s signature once the network confirms it', async () => {
    const connection = connectionFor(SolanaNetwork.Devnet)
    const confirm = vi
      .spyOn(connection, 'confirmTransaction')
      .mockResolvedValue({ context: { slot: 1 }, value: { err: null } })

    const sent = await signAndSendPrepared(
      connection,
      connectedReturning([{ signature }]),
      prepared(blockhash),
      SolanaNetwork.Devnet,
    )

    expect(sent).toEqual(expect.any(String))
    expect(confirm).toHaveBeenCalledWith(
      { signature: sent, blockhash, lastValidBlockHeight: 9 },
      'confirmed',
    )
  })

  it('fails when the wallet returns nothing or the transaction fails on chain', async () => {
    const connection = connectionFor(SolanaNetwork.Devnet)
    await expect(
      signAndSendPrepared(
        connection,
        connectedReturning([]),
        prepared(blockhash),
        SolanaNetwork.Devnet,
      ),
    ).rejects.toThrow('Wallet returned no signature')
    vi.spyOn(connection, 'confirmTransaction').mockResolvedValue({
      context: { slot: 1 },
      value: { err: 'InsufficientFundsForFee' },
    })
    await expect(
      signAndSendPrepared(
        connection,
        connectedReturning([{ signature }]),
        prepared(blockhash),
        SolanaNetwork.Devnet,
      ),
    ).rejects.toThrow('Transaction failed: "InsufficientFundsForFee"')
  })
})
