import { describe, expect, it } from 'vitest'
import { canPrepare, isSafeWalletIcon } from '.'
import { SolanaNetwork } from '../../core/shared'

describe('canPrepare', () => {
  it('allows devnet without acknowledgement', () => {
    expect(canPrepare(SolanaNetwork.Devnet, false)).toBe(true)
  })

  it('blocks mainnet until acknowledged', () => {
    expect(canPrepare(SolanaNetwork.Mainnet, false)).toBe(false)
    expect(canPrepare(SolanaNetwork.Mainnet, true)).toBe(true)
  })
})

describe('isSafeWalletIcon', () => {
  it('accepts data image URIs only', () => {
    expect(isSafeWalletIcon('data:image/svg+xml;base64,AAAA')).toBe(true)
    expect(isSafeWalletIcon('javascript:alert(1)')).toBe(false)
    expect(isSafeWalletIcon('https://evil.example/icon.png')).toBe(false)
  })
})
