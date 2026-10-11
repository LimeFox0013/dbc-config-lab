import { describe, expect, it } from 'vitest'
import { PublicKey } from '@solana/web3.js'
import type { ConnectedWallet } from '@dbc-config-lab/core/features/wallet'
import {
  deployWalletFixture,
  FAKE_ADDRESS,
  renderComponent,
} from '../../testing'
import WalletPicker from './WalletPicker.vue'
import type { WalletPickerProps } from './types'

const NO_WALLET = 'Install a wallet to deploy.'

const render = (props: Partial<WalletPickerProps>): Promise<string> =>
  renderComponent(WalletPicker, {
    wallets: [],
    connected: null,
    disabled: false,
    noWalletText: NO_WALLET,
    ...props,
  })

const connectedTo = (name: string): ConnectedWallet => ({
  wallet: deployWalletFixture(name),
  account: {
    address: FAKE_ADDRESS,
    publicKey: new PublicKey(FAKE_ADDRESS).toBytes(),
    chains: [],
    features: [],
  },
  owner: new PublicKey(FAKE_ADDRESS),
})

describe('WalletPicker', () => {
  it('says what a wallet is for when none is installed', async () => {
    expect(await render({})).toContain(NO_WALLET)
  })

  it('offers each installed wallet, with its icon', async () => {
    const html = await render({
      wallets: [
        deployWalletFixture('Phantom'),
        deployWalletFixture('Backpack'),
      ],
    })
    expect(html).toContain('Connect Phantom')
    expect(html).toContain('Connect Backpack')
    expect(html).toContain('wallet-picker__icon')
    expect(html).not.toContain(NO_WALLET)
  })

  it('keeps the wallet from being switched while something is signed', async () => {
    const html = await render({
      wallets: [deployWalletFixture('Phantom')],
      disabled: true,
    })
    expect(html).toContain('disabled')
  })

  it('names the connected wallet and its address instead of offering others', async () => {
    const html = await render({
      wallets: [deployWalletFixture('Phantom')],
      connected: connectedTo('Phantom'),
    })
    expect(html).toContain(`Connected: Phantom · ${FAKE_ADDRESS}`)
    expect(html).not.toContain('Connect Phantom')
  })
})
