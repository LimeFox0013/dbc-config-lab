import { SolanaNetwork } from '@dbc-config-lab/core/core/shared'

/** An environment variable the service cannot start without. */
export const requiredEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} environment variable is required`)
  return value
}

/** A stored or configured network name; anything but devnet is mainnet. */
export const networkOf = (name: string | undefined): SolanaNetwork =>
  name === SolanaNetwork.Devnet ? SolanaNetwork.Devnet : SolanaNetwork.Mainnet
