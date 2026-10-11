import { SolanaNetwork } from '@dbc-config-lab/core/core/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { networkOf, requiredEnv } from './utils'

describe('networkOf', () => {
  it('treats anything but devnet as mainnet', () => {
    expect(networkOf('devnet')).toBe(SolanaNetwork.Devnet)
    expect(networkOf(undefined)).toBe(SolanaNetwork.Mainnet)
    expect(networkOf('testnet')).toBe(SolanaNetwork.Mainnet)
  })
})

describe('requiredEnv', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('reads a variable that is set', () => {
    vi.stubEnv('LAB_SPEC_VALUE', 'set')
    expect(requiredEnv('LAB_SPEC_VALUE')).toBe('set')
  })

  it('refuses to go on without it, naming the variable', () => {
    vi.stubEnv('LAB_SPEC_VALUE', '')
    expect(() => requiredEnv('LAB_SPEC_VALUE')).toThrow(
      'LAB_SPEC_VALUE environment variable is required',
    )
  })
})
