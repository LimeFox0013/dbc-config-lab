import { ALLOWED_PROTOCOLS, SsrfErrorCode } from './constants.js'
import { resolvePublicAddresses } from './resolve-public-addresses.js'
import type { SsrfError } from './types.js'
import { isSsrfError } from './utils.js'

/**
 * Parse a URL and enforce the protocol allow-list — the checks that need no network.
 *
 * @returns the parsed URL, or a typed {@link SsrfError}. Never throws.
 */
export function parseAllowedUrl(url: string): URL | SsrfError {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return {
      code: SsrfErrorCode.ERR_INVALID_URL,
      message: `Invalid URL: ${url}`,
    }
  }

  if (!(ALLOWED_PROTOCOLS as readonly string[]).includes(parsed.protocol)) {
    return {
      code: SsrfErrorCode.ERR_PROTOCOL_FORBIDDEN,
      message: `Protocol "${parsed.protocol}" not allowed; only http/https are permitted.`,
    }
  }

  return parsed
}

/**
 * Validate a URL against SSRF rules before any network call.
 *
 * Checks performed (in order):
 * 1. URL must be parseable.
 * 2. Protocol must be one of the {@link ALLOWED_PROTOCOLS}.
 * 3. Every address the hostname resolves to must be public (non-private).
 *
 * This is a point-in-time check (e.g. to reject a URL at registration). It does
 * not protect a later request on its own — DNS may answer differently by then;
 * `safeFetch` re-vets at connect time.
 *
 * @returns `null` when safe, or a typed {@link SsrfError} when blocked.
 *   Never throws – callers decide what to do with the error.
 */
export async function sanitizeUrl(url: string): Promise<SsrfError | null> {
  const parsed = parseAllowedUrl(url)
  if (isSsrfError(parsed)) return parsed

  const resolved = await resolvePublicAddresses(parsed.hostname)
  return isSsrfError(resolved) ? resolved : null
}
