import { SAFE_FETCH_TIMEOUT_MS } from './constants.js'
import {
  findSsrfBlockedError,
  guardedDispatcher,
} from './guarded-dispatcher.js'
import { parseAllowedUrl } from './sanitize-url.js'
import type { SsrfError } from './types.js'
import { isSsrfError } from './utils.js'

/**
 * SSRF-safe wrapper around the native `fetch` API.
 *
 * The URL must parse and use an allowed protocol. Every connection the request
 * opens (including each redirect hop) resolves its hostname once, refuses it if
 * ANY resolved address is private/reserved, and connects only to the vetted
 * addresses — so a DNS answer that changes between check and connect (DNS
 * rebinding) cannot reach an internal address. A caller-supplied `dispatcher`
 * is ignored.
 *
 * If the URL is blocked, the returned promise resolves with an `SsrfError`
 * rather than a `Response` — callers narrow on the discriminant `'code'` field.
 *
 * A default timeout of {@link SAFE_FETCH_TIMEOUT_MS} is applied unless the
 * caller supplies their own `signal`.
 *
 * @example
 * ```ts
 * const result = await safeFetch('https://example.com/video.mp4');
 * if ('code' in result) { /* SSRF blocked *\/ }
 * else { const text = await result.text(); }
 * ```
 */
export async function safeFetch(
  url: string,
  init?: RequestInit,
): Promise<Response | SsrfError> {
  const parsed = parseAllowedUrl(url)
  if (isSsrfError(parsed)) {
    return parsed
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SAFE_FETCH_TIMEOUT_MS)

  try {
    // The dispatcher is attached by Object.assign so its type intersects with the
    // fetch typings' own `Dispatcher` — those come from whichever undici-types
    // version @types/node pins, which need not match the installed undici.
    const guardedInit = Object.assign(
      { ...init, signal: init?.signal ?? controller.signal },
      { dispatcher: guardedDispatcher },
    )
    return await fetch(parsed, guardedInit)
  } catch (error) {
    const blocked = findSsrfBlockedError(error)
    if (blocked) return blocked.ssrfError
    throw error
  } finally {
    clearTimeout(timer)
  }
}
