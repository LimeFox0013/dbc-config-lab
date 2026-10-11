import { describe, expect, it } from 'vitest'
import { SolanaNetwork } from '../../core/shared'
import { launchPagePath, networkFromQuery, reportPagePath } from '.'

describe('launch page links', () => {
  it('put the address in the path and the network in the query', () => {
    expect(launchPagePath('Cfg1', SolanaNetwork.Devnet)).toBe(
      '/launch/Cfg1?network=devnet',
    )
    expect(reportPagePath('Pool 2', SolanaNetwork.Mainnet)).toBe(
      '/config/Pool%202?network=mainnet-beta',
    )
  })
})

describe('networkFromQuery', () => {
  it('reads a known network and falls back to mainnet otherwise', () => {
    expect(networkFromQuery('devnet')).toBe(SolanaNetwork.Devnet)
    expect(networkFromQuery('testnet')).toBe(SolanaNetwork.Mainnet)
    expect(networkFromQuery(['devnet'])).toBe(SolanaNetwork.Mainnet)
    expect(networkFromQuery(undefined)).toBe(SolanaNetwork.Mainnet)
  })
})
