import {
  BRANDING_NAME_LIMIT,
  BRANDING_URL_LIMIT,
  BRANDING_URL_SCHEME,
  BrandingRejection,
} from './constants'
import type { PartnerBranding } from './types'

/** https, parseable, and with no `user@` part — `https://real.app@other.host` goes to other.host. */
const isHttps = (url: string): boolean => {
  if (!url.startsWith(BRANDING_URL_SCHEME) || !URL.canParse(url)) return false
  const parsed = new URL(url)
  return parsed.username === '' && parsed.password === ''
}

/** Control and formatting characters (bidi overrides, zero-width joiners) that can disguise text. */
const HIDDEN_CHARACTERS = /[\p{Cc}\p{Cf}]/gu

/** A name read from chain, as safe to show: hidden characters removed, at most the name limit. */
export const displayBrandingName = (name: string): string =>
  [...name.replace(HIDDEN_CHARACTERS, '').trim()]
    .slice(0, BRANDING_NAME_LIMIT)
    .join('')

/** The host a safe URL really points at, in its ASCII (punycode) form, so look-alike letters show. */
export const brandingHost = (url: string): string => new URL(url).hostname

/** The URL when it is safe to link or show, otherwise null — branding is read from anyone's wallet. */
export const safeBrandingUrl = (url: string): string | null =>
  url.length <= BRANDING_URL_LIMIT && isHttps(url) ? url : null

/** The branding exactly as it goes on chain. */
export const trimmedBranding = (
  branding: PartnerBranding,
): PartnerBranding => ({
  name: branding.name.trim(),
  website: branding.website.trim(),
  logo: branding.logo.trim(),
})

/** The first reason the branding cannot be written, or null when it can. */
export const brandingRejection = (
  branding: PartnerBranding,
): BrandingRejection | null => {
  const { name, website, logo } = trimmedBranding(branding)
  if (name.length === 0) return BrandingRejection.NameMissing
  if (name.length > BRANDING_NAME_LIMIT) return BrandingRejection.NameTooLong
  if (name !== name.replace(HIDDEN_CHARACTERS, ''))
    return BrandingRejection.NameCharacters
  if (website.length > BRANDING_URL_LIMIT)
    return BrandingRejection.WebsiteTooLong
  if (website.length > 0 && !isHttps(website))
    return BrandingRejection.WebsiteScheme
  if (logo.length > BRANDING_URL_LIMIT) return BrandingRejection.LogoTooLong
  if (logo.length > 0 && !isHttps(logo)) return BrandingRejection.LogoScheme
  return null
}
