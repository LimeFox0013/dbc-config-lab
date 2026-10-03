/** What the signing step reports when a wallet or the network lets it down. */
export const WALLET_ERRORS = {
  noAccount: (wallet: string, network: string): string =>
    `${wallet} has no account for ${network}`,
  noSignature: 'Wallet returned no signature',
  noBlockhash: 'Transaction has no blockhash',
  failed: (error: unknown): string =>
    `Transaction failed: ${JSON.stringify(error)}`,
} as const
