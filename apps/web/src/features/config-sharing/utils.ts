import { compileLaunchConfig } from '../../core/launch-config'
import type { LaunchConfig } from '../../core/launch-config'
import { QUOTE_TOKENS } from '../../core/quote-token'
import { isRecord, SolanaNetwork } from '../../core/shared'
import {
  ADDRESS_MAX_LENGTH,
  BUILDER_BY_SHAPE,
  MAX_SHARE_LENGTH,
  NAME_MAX_LENGTH,
  NON_BUILDER_KEYS,
  SHARE_PARAM,
  SHARE_VERSION,
  ShareRejection,
} from './constants'
import { readLaunchConfig, ReadError } from './document'
import { finiteNumber, record, text } from './readers'
import type { DecodeResult, Reader, SharedConfig } from './types'
import { royaltyRejection } from '../../core/preset-royalty'
import type { PresetRoyalty } from '../../core/preset-royalty'

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const fromBase64Url = (encoded: string): Uint8Array => {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

/** The config as a URL-fragment-safe string. */
export const encodeSharedConfig = (shared: SharedConfig): string =>
  toBase64Url(
    new TextEncoder().encode(JSON.stringify({ v: SHARE_VERSION, ...shared })),
  )

/** A full link to this page that reopens the config. The config rides in the fragment. */
export const shareLink = (shared: SharedConfig, pageUrl: string): string => {
  const url = new URL(pageUrl)
  url.hash = `${SHARE_PARAM}=${encodeSharedConfig(shared)}`
  return url.toString()
}

/** The encoded config carried by a URL fragment, if any. */
export const sharedFromHash = (hash: string): string | null =>
  new URLSearchParams(hash.replace(/^#/, '')).get(SHARE_PARAM)

/**
 * Decodes an untrusted shared config: size cap → base64url → JSON → typed rebuild of every
 * field (unknown fields dropped) → the DBC program's own validation.
 */
export const decodeSharedConfig = (encoded: string): DecodeResult => {
  if (encoded.length > MAX_SHARE_LENGTH)
    return { ok: false, rejection: ShareRejection.TooLong }

  let json: string
  try {
    json = new TextDecoder('utf-8', { fatal: true }).decode(
      fromBase64Url(encoded),
    )
  } catch {
    return { ok: false, rejection: ShareRejection.NotDecodable }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, rejection: ShareRejection.NotJson }
  }

  if (isRecord(parsed) && parsed['v'] !== SHARE_VERSION)
    return { ok: false, rejection: ShareRejection.WrongVersion }
  return readSharedConfig(parsed, 'link')
}

/**
 * Rebuilds an untrusted, already-parsed shared config field by field (unknown fields
 * dropped), then applies the DBC program's own validation. `path` prefixes field paths.
 */
export const readSharedConfig = (
  value: unknown,
  path: string,
): DecodeResult => {
  let shared: SharedConfig
  try {
    const fields = record(value, path)
    const config = readLaunchConfig(fields['config'], 'config')
    const name =
      fields['name'] === undefined
        ? undefined
        : text(NAME_MAX_LENGTH)(fields['name'], 'name')
    const royalty =
      fields['royalty'] === undefined
        ? undefined
        : readRoyalty(fields['royalty'], 'royalty')
    shared = {
      config,
      ...(name === undefined ? {} : { name }),
      ...(royalty === undefined ? {} : { royalty }),
    }
  } catch (error) {
    if (error instanceof ReadError)
      return {
        ok: false,
        rejection: ShareRejection.InvalidField,
        detail: error.path,
      }
    throw error
  }

  const compiled = compileLaunchConfig(shared.config)
  if (!compiled.ok)
    return {
      ok: false,
      rejection: ShareRejection.RejectedByProgram,
      detail: compiled.reason,
    }
  const refused =
    shared.royalty && royaltyRejection(shared.royalty, compiled.parameters)
  if (refused)
    return {
      ok: false,
      rejection: ShareRejection.RoyaltyRefused,
      detail: refused,
    }
  return { ok: true, shared }
}

const readRoyalty: Reader<PresetRoyalty> = (value, path) => {
  const fields = record(value, path)
  return {
    author: text(ADDRESS_MAX_LENGTH)(fields['author'], `${path}.author`),
    sharePercent: finiteNumber(fields['sharePercent'], `${path}.sharePercent`),
  }
}

/** The builder's own parameters: everything but the tool's `curveShape` selector. */
/** The builder's own parameters; quote decimals follow the quote token, as when compiling. */
const builderParams = (config: LaunchConfig): string =>
  JSON.stringify(
    {
      ...config,
      token: {
        ...config.token,
        tokenQuoteDecimal: QUOTE_TOKENS[config.quoteToken].decimals,
      },
    },
    (key, value: unknown) => (NON_BUILDER_KEYS.has(key) ? undefined : value),
    2,
  )

/** Ready-to-run TypeScript that creates this config on chain with the Meteora SDK. */
export const toTypeScript = (config: LaunchConfig): string => {
  const builder = BUILDER_BY_SHAPE[config.curveShape]
  return `import { ${builder}, DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'

// Generated by DBC Config Lab. Enum fields are the SDK's numeric enum values.
const parameters = ${builder}(${builderParams(config)})

const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
const client = new DynamicBondingCurveClient(connection, 'confirmed')
const wallet = new PublicKey('<your wallet address>')
const configKey = Keypair.generate()

const transaction = await client.partner.createConfig({
  ...parameters,
  config: configKey.publicKey,
  feeClaimer: wallet,
  leftoverReceiver: wallet,
  quoteMint: new PublicKey('${QUOTE_TOKENS[config.quoteToken].mints[SolanaNetwork.Devnet]}'), // ${QUOTE_TOKENS[config.quoteToken].symbol} on devnet
  payer: wallet,
})
// Sign with configKey and your wallet, then send.
`
}
