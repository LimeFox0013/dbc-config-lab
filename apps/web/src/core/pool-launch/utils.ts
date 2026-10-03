import BN from 'bn.js'
import {
  FIRST_BUY_SLIPPAGE_BPS,
  METADATA_LIMITS,
  METADATA_URI_SCHEMES,
  MetadataRejection,
} from './constants'
import type { TokenMetadata } from './types'
import { BPS_SCALE } from '../launch-simulator'

/** The first reason the metadata cannot be used, or null when it can. */
export const metadataRejection = (
  metadata: TokenMetadata,
): MetadataRejection | null => {
  const name = metadata.name.trim()
  const symbol = metadata.symbol.trim()
  const uri = metadata.uri.trim()
  if (name.length === 0) return MetadataRejection.NameMissing
  if (name.length > METADATA_LIMITS.name) return MetadataRejection.NameTooLong
  if (symbol.length === 0) return MetadataRejection.SymbolMissing
  if (symbol.length > METADATA_LIMITS.symbol)
    return MetadataRejection.SymbolTooLong
  if (uri.length > METADATA_LIMITS.uri) return MetadataRejection.UriTooLong
  if (uri.length > 0 && !METADATA_URI_SCHEMES.some((s) => uri.startsWith(s)))
    return MetadataRejection.UriScheme
  return null
}

/** The metadata exactly as it goes on chain. */
export const trimmedMetadata = (metadata: TokenMetadata): TokenMetadata => ({
  name: metadata.name.trim(),
  symbol: metadata.symbol.trim(),
  uri: metadata.uri.trim(),
})

/** The least the first buy may receive before the program fails it. */
export const minimumFirstBuyOut = (expected: BN): BN =>
  expected.muln(BPS_SCALE - FIRST_BUY_SLIPPAGE_BPS).divn(BPS_SCALE)
