import { SolanaNetwork } from '../shared'

export { SolanaNetwork }

/** Wallet Standard chain identifiers. */
export enum SolanaChain {
  Devnet = 'solana:devnet',
  Mainnet = 'solana:mainnet',
}

export const CHAIN_BY_NETWORK: Record<SolanaNetwork, SolanaChain> = {
  [SolanaNetwork.Devnet]: SolanaChain.Devnet,
  [SolanaNetwork.Mainnet]: SolanaChain.Mainnet,
}

/** Public endpoints only; no API keys ever ship to the browser. */
export const RPC_ENDPOINT_BY_NETWORK: Record<SolanaNetwork, string> = {
  [SolanaNetwork.Devnet]: 'https://api.devnet.solana.com',
  [SolanaNetwork.Mainnet]: 'https://api.mainnet-beta.solana.com',
}

export const EXPLORER_BASE_URL = 'https://explorer.solana.com'

export const COMMITMENT = 'confirmed'
