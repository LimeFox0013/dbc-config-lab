/** Base58 of a 32-byte key whose last byte is 1 — a valid, obviously fake address. */
export const FAKE_WALLET_ADDRESS = '11111111111111111111111111111112'
export const FAKE_WALLET_NAME = 'E2E Test Wallet'
/** The hosted account API the site calls by default (VITE_DBC_LAB_API_URL unset). */
export const ACCOUNT_API = 'https://lf-aw-pod.dbc-lab-api.at.lime-fox.net'
/** Valid, fixed public keys standing in for the operator's wallet and a payment reference. */
export const PAYMENT_RECIPIENT = 'Dtnqy9Z3KgoVXe6dApLbVfHZmVG2qHYwpZTcnFNXTXvj'
export const PAYMENT_REFERENCE = '4tRapEGgJZKuGoeeMRrpHsxAEuvo5YnDCzTXykqDhrK9'
export const DEVNET_RPC = 'https://api.devnet.solana.com/'
export const DEVNET_WS = 'wss://api.devnet.solana.com/'
/** Any valid base58 32-byte value works as a blockhash for a dry run that is mocked. */
export const FAKE_BLOCKHASH = 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi'
/** SPL Token program, which owns ordinary mints such as wrapped SOL. */
export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
export const WRAPPED_SOL_MINT = 'So11111111111111111111111111111111111111112'
/** Meteora's DBC program id (the SDK's DYNAMIC_BONDING_CURVE_PROGRAM_ID). */
export const DBC_PROGRAM = 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN'
