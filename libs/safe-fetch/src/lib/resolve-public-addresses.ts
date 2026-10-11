import { lookup } from 'node:dns/promises'
import type { LookupAddress } from 'node:dns'
import { SsrfErrorCode } from './constants.js'
import { isPrivateIp } from './private-ip.js'
import type { ResolvedAddresses, SsrfError } from './types.js'
import { stripIpv6Brackets } from './utils.js'

const isNonEmpty = (
  addresses: LookupAddress[],
): addresses is [LookupAddress, ...LookupAddress[]] => addresses.length > 0

/**
 * Resolve every address a hostname maps to and vet all of them.
 *
 * One private/reserved address among the results blocks the whole hostname —
 * a client may connect to any of them. The returned list is exactly what was
 * vetted, so a caller that connects only to these addresses has no gap between
 * check and use (no DNS-rebinding window).
 *
 * Never throws: DNS failure comes back as `ERR_DNS_FAILURE`.
 */
export async function resolvePublicAddresses(
  host: string,
): Promise<ResolvedAddresses | SsrfError> {
  const hostname = stripIpv6Brackets(host)
  let addresses: LookupAddress[]
  try {
    addresses = await lookup(hostname, { all: true })
  } catch {
    addresses = []
  }

  if (!isNonEmpty(addresses)) {
    return {
      code: SsrfErrorCode.ERR_DNS_FAILURE,
      message: `DNS lookup failed for "${hostname}".`,
    }
  }

  const blocked = addresses.find(({ address }) => isPrivateIp(address))
  if (blocked) {
    return {
      code: SsrfErrorCode.ERR_PRIVATE_IP,
      message: `Hostname "${hostname}" resolves to private IP ${blocked.address}.`,
    }
  }

  return addresses
}
