import { SolanaNetwork } from '../shared'

/** Wallet Standard chain identifiers. */
export enum SolanaChain {
  Devnet = 'solana:devnet',
  Mainnet = 'solana:mainnet',
}

export const CHAIN_BY_NETWORK: Record<SolanaNetwork, SolanaChain> = {
  [SolanaNetwork.Devnet]: SolanaChain.Devnet,
  [SolanaNetwork.Mainnet]: SolanaChain.Mainnet,
}

/** Public endpoints; no API keys ever ship to the browser. */
export const PUBLIC_RPC_ENDPOINT_BY_NETWORK: Record<SolanaNetwork, string> = {
  [SolanaNetwork.Devnet]: 'https://api.devnet.solana.com',
  [SolanaNetwork.Mainnet]: 'https://api.mainnet-beta.solana.com',
}

/**
 * Where a page reaches mainnet: the public endpoint refuses requests from browsers, so the
 * site serves its own proxy here, which holds the RPC provider's key on the server.
 */
export const MAINNET_RPC_PROXY_PATH = '/rpc/mainnet'

export const EXPLORER_BASE_URL = 'https://explorer.solana.com'

export const COMMITMENT = 'confirmed'
