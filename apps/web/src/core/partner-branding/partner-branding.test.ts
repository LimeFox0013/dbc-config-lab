import { Keypair } from '@solana/web3.js'
import { describe, expect, it, vi } from 'vitest'
import { connectionFor } from '../config-deploy'
import {
  brandingHost,
  BrandingRejection,
  brandingRejection,
  displayBrandingName,
  preparePartnerBranding,
  readPartnerBranding,
  safeBrandingUrl,
} from '.'
import { SolanaNetwork } from '../shared'

const branding = {
  name: 'Fair Launches',
  website: 'https://fair.example',
  logo: 'https://fair.example/logo.png',
}

describe('brandingRejection', () => {
  it('accepts a name with optional https links', () => {
    expect(brandingRejection(branding)).toBeNull()
    expect(
      brandingRejection({ name: 'Fair', website: '', logo: '' }),
    ).toBeNull()
  })

  it('refuses a missing or long name and any link that is not https', () => {
    expect(brandingRejection({ ...branding, name: '  ' })).toBe(
      BrandingRejection.NameMissing,
    )
    expect(brandingRejection({ ...branding, name: 'x'.repeat(33) })).toBe(
      BrandingRejection.NameTooLong,
    )
    expect(
      brandingRejection({ ...branding, website: 'javascript:alert(1)' }),
    ).toBe(BrandingRejection.WebsiteScheme)
    expect(
      brandingRejection({ ...branding, logo: 'http://fair.example/logo.png' }),
    ).toBe(BrandingRejection.LogoScheme)
  })
})

describe('safeBrandingUrl', () => {
  it('refuses a URL whose user@ part disguises the host it opens', () => {
    expect(safeBrandingUrl('https://real.app@other.example')).toBeNull()
    expect(safeBrandingUrl('https://real.app:x@other.example')).toBeNull()
    expect(
      brandingRejection({
        ...branding,
        website: 'https://real.app@other.example',
      }),
    ).toBe(BrandingRejection.WebsiteScheme)
  })

  it('passes only well-formed https URLs from chain', () => {
    expect(safeBrandingUrl('https://fair.example')).toBe('https://fair.example')
    expect(safeBrandingUrl('javascript:alert(1)')).toBeNull()
    expect(safeBrandingUrl('data:image/svg+xml,<svg/>')).toBeNull()
    expect(safeBrandingUrl('https://')).toBeNull()
  })
})

describe('partner branding on chain', () => {
  const connection = connectionFor(SolanaNetwork.Devnet)
  const owner = Keypair.generate().publicKey

  it('reads no branding for a wallet that has none', async () => {
    vi.spyOn(connection, 'getAccountInfo').mockResolvedValue(null)
    expect(await readPartnerBranding(connection, owner.toBase58())).toBeNull()
  })

  it('refuses to build a transaction for branding it would not show', async () => {
    expect(
      await preparePartnerBranding(connection, {
        branding: { ...branding, website: 'ftp://fair.example' },
        owner,
      }),
    ).toEqual({ ok: false, reason: BrandingRejection.WebsiteScheme })
  })
})

describe('names and hosts from chain', () => {
  it('drops hidden characters and caps the name as shown', () => {
    expect(displayBrandingName('Fair\u202ELaunches\u200B')).toBe('FairLaunches')
    expect(displayBrandingName('x'.repeat(100))).toHaveLength(32)
    expect(brandingRejection({ ...branding, name: 'Fair\u202ELaunches' })).toBe(
      BrandingRejection.NameCharacters,
    )
  })

  it('shows the host a link really opens, look-alike letters in their ASCII form', () => {
    expect(brandingHost('https://fair.example/path?q=1')).toBe('fair.example')
    expect(brandingHost('https://\u0430pple.example')).toBe(
      'xn--pple-43d.example',
    )
  })
})
