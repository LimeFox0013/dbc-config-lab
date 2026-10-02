import { PublicKey } from '@solana/web3.js'

export enum SolanaNetwork {
  Devnet = 'devnet',
  Mainnet = 'mainnet-beta',
}

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

/** Wrapped SOL mint — the quote token every config here is priced in. */
export const NATIVE_SOL_MINT = new PublicKey(
  'So11111111111111111111111111111111111111112',
)

export const EXPLORER_BASE_URL = 'https://explorer.solana.com'

export const COMMITMENT = 'confirmed'
