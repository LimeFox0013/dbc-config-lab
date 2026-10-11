import {
  compileLaunchConfig,
  DEFAULT_LAUNCH_CONFIG,
} from '@dbc-config-lab/core/core/launch-config'
import { QuoteToken } from '@dbc-config-lab/core/core/quote-token'
import { SolanaNetwork } from '@dbc-config-lab/core/core/shared'
import type { OnChainConfig } from '@dbc-config-lab/core/features/onchain-config'
import { isDeployCapable } from '@dbc-config-lab/core/features/wallet'
import type { DeployWallet } from '@dbc-config-lab/core/features/wallet'

/** Base58 of a 32-byte key whose last byte is 1 — a valid, obviously fake address. */
export const FAKE_ADDRESS = '11111111111111111111111111111112'

/** The lab's default config as if read from mainnet: SOL-priced, 85 SOL to graduate. */
export const onChainConfigFixture = (
  overrides: Partial<OnChainConfig> = {},
): OnChainConfig => {
  const compiled = compileLaunchConfig(DEFAULT_LAUNCH_CONFIG)
  if (!compiled.ok) throw new Error('The default config must compile')
  return {
    configAddress: FAKE_ADDRESS,
    network: SolanaNetwork.Mainnet,
    feeClaimer: FAKE_ADDRESS,
    parameters: compiled.parameters,
    quoteToken: QuoteToken.Sol,
    ...overrides,
  }
}

/** A Wallet Standard wallet that can connect and sign, as the page lists one. */
export const deployWalletFixture = (name = 'Test wallet'): DeployWallet => {
  const wallet = {
    version: '1.0.0' as const,
    name,
    icon: 'data:image/svg+xml;base64,' as const,
    chains: [],
    features: { 'standard:connect': {}, 'solana:signAndSendTransaction': {} },
    accounts: [],
  }
  if (!isDeployCapable(wallet))
    throw new Error('The test wallet must be able to deploy')
  return wallet
}
