import type { LookupFunction } from 'node:net'
import { isIP } from 'node:net'
import { Agent, buildConnector } from 'undici'
import { SsrfErrorCode } from './constants.js'
import { isPrivateIp } from './private-ip.js'
import { resolvePublicAddresses } from './resolve-public-addresses.js'
import type { SsrfError } from './types.js'
import { isSsrfError, stripIpv6Brackets } from './utils.js'

/** Raised inside the connector when a connection target is blocked; carries the typed error. */
export class SsrfBlockedError extends Error {
  constructor(readonly ssrfError: SsrfError) {
    super(ssrfError.message)
    this.name = 'SsrfBlockedError'
  }
}

/**
 * `net`/`tls` lookup that resolves once, vets every address, and hands the socket
 * only those vetted addresses — the address checked is the address connected to.
 */
export const vettedLookup: LookupFunction = (hostname, options, callback) => {
  void resolvePublicAddresses(hostname).then((resolved) => {
    if (isSsrfError(resolved)) {
      callback(new SsrfBlockedError(resolved), '')
      return
    }
    if (options.all) {
      callback(null, [...resolved])
      return
    }
    const [preferred] = resolved
    callback(null, preferred.address, preferred.family)
  })
}

const pinnedConnector = buildConnector({ lookup: vettedLookup })

/**
 * Every connection — the first request and each redirect hop — passes here.
 * Hostnames go through {@link vettedLookup}; IP literals skip DNS (and the
 * lookup hook), so they are vetted directly.
 */
const guardedConnector: buildConnector.connector = (options, callback) => {
  const host = stripIpv6Brackets(options.hostname)
  if (isIP(host) && isPrivateIp(host)) {
    callback(
      new SsrfBlockedError({
        code: SsrfErrorCode.ERR_PRIVATE_IP,
        message: `Address ${host} is private.`,
      }),
      null,
    )
    return
  }
  pinnedConnector(options, callback)
}

/**
 * Shared dispatcher for `safeFetch`. TLS still verifies against the URL's
 * hostname (undici derives SNI/servername from it); only the IP is pinned.
 */
export const guardedDispatcher = new Agent({ connect: guardedConnector })

/** Find an {@link SsrfBlockedError} in a fetch rejection's `cause` chain. */
export const findSsrfBlockedError = (
  error: unknown,
): SsrfBlockedError | null => {
  if (error instanceof SsrfBlockedError) return error
  if (error instanceof Error) return findSsrfBlockedError(error.cause)
  return null
}
