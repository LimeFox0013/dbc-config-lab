import { TokenAuthorityOption } from '@meteora-ag/dynamic-bonding-curve-sdk'

/** Metaplex token-metadata limits the program passes the name, symbol and URI to. */
export const METADATA_LIMITS = {
  name: 32,
  symbol: 10,
  uri: 200,
} as const

/** Where a token's metadata JSON may live; anything else is refused. */
export const METADATA_URI_SCHEMES: readonly string[] = [
  'https://',
  'ipfs://',
  'ar://',
]

/**
 * The first buy runs in the transaction that creates the pool, so nothing can trade
 * before it; the minimum output still allows this much below the quoted amount.
 */
export const FIRST_BUY_SLIPPAGE_BPS = 100

export enum MetadataRejection {
  NameMissing = 'name-missing',
  NameTooLong = 'name-too-long',
  SymbolMissing = 'symbol-missing',
  SymbolTooLong = 'symbol-too-long',
  UriTooLong = 'uri-too-long',
  UriScheme = 'uri-scheme',
}

/** Token authority options that leave the config's partner, not the creator, in control. */
export const PARTNER_AUTHORITY_OPTIONS: ReadonlySet<TokenAuthorityOption> =
  new Set([
    TokenAuthorityOption.PartnerUpdateAuthority,
    TokenAuthorityOption.PartnerUpdateAndMintAuthority,
  ])
