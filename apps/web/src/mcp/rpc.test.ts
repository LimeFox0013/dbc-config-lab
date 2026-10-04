import { afterEach, describe, expect, it } from 'vitest'
import { connectionFor } from '../core/config-deploy'
import { SolanaNetwork } from '../core/shared'
import { RPC_URL_ENV } from './constants'
import { rpcConnection } from './utils'

const MAINNET_ENV = RPC_URL_ENV[SolanaNetwork.Mainnet]
const PROVIDER_URL = 'https://rpc.example/?api-key=secret-key'

afterEach(() => {
  delete process.env[MAINNET_ENV]
})

describe('agent RPC endpoints', () => {
  it('uses the public endpoint when none is configured', () => {
    expect(rpcConnection(SolanaNetwork.Mainnet).rpcEndpoint).toBe(
      connectionFor(SolanaNetwork.Mainnet).rpcEndpoint,
    )
  })

  it('uses the configured endpoint for its own network only', () => {
    process.env[MAINNET_ENV] = PROVIDER_URL
    expect(rpcConnection(SolanaNetwork.Mainnet).rpcEndpoint).toBe(PROVIDER_URL)
    expect(rpcConnection(SolanaNetwork.Devnet).rpcEndpoint).toBe(
      connectionFor(SolanaNetwork.Devnet).rpcEndpoint,
    )
  })

  it('refuses a value that is not an http(s) URL, naming the variable but not the value', () => {
    process.env[MAINNET_ENV] = 'file:///etc/secret-key'
    expect(() => rpcConnection(SolanaNetwork.Mainnet)).toThrow(MAINNET_ENV)
    expect(() => rpcConnection(SolanaNetwork.Mainnet)).not.toThrow('secret-key')
  })
})
