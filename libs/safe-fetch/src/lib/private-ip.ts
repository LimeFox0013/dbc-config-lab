import { BlockList, isIPv4, isIPv6 } from 'node:net'
import {
  BLOCKED_IPV4_SUBNETS,
  BLOCKED_IPV6_SUBNETS,
  IPV4_EMBEDDING_IPV6_PREFIXES,
  IpFamily,
} from './constants.js'
import type { Subnet } from './types.js'
import { stripIpv6Brackets } from './utils.js'

const IPV4_BITS = 32
const IPV6_BITS = 128

/**
 * IPv4 ranges re-expressed inside an IPv6 prefix that embeds an IPv4 address in
 * its low 32 bits (e.g. NAT64 `64:ff9b::10.0.0.1` reaches `10.0.0.1`).
 */
const embeddedIpv4Subnets = (embeddingPrefix: string): Subnet[] =>
  BLOCKED_IPV4_SUBNETS.map(({ network, prefix }) => ({
    network: `${embeddingPrefix}${network}`,
    prefix: IPV6_BITS - IPV4_BITS + prefix,
  }))

const buildBlockList = (): BlockList => {
  const list = new BlockList()
  BLOCKED_IPV4_SUBNETS.forEach(({ network, prefix }) =>
    list.addSubnet(network, prefix, IpFamily.V4),
  )
  ;[
    ...BLOCKED_IPV6_SUBNETS,
    ...IPV4_EMBEDDING_IPV6_PREFIXES.flatMap(embeddedIpv4Subnets),
  ].forEach(({ network, prefix }) =>
    list.addSubnet(network, prefix, IpFamily.V6),
  )
  return list
}

const BLOCKED = buildBlockList()

/**
 * Determine whether an IP address belongs to a private, loopback, link-local,
 * multicast or otherwise reserved range — i.e. one an outbound request to a
 * user-supplied URL must never reach. IPv4 addresses embedded in IPv6
 * (`::ffff:a.b.c.d` mapped, `64:ff9b::/96` NAT64) are judged by the IPv4 they carry.
 *
 * @param ip - IPv4 or IPv6 address string (an IPv6 literal may keep its URL brackets)
 * @returns `true` if the IP is private/reserved; `false` for public addresses
 *   and for strings that are not IP addresses at all
 */
export function isPrivateIp(ip: string): boolean {
  const address = stripIpv6Brackets(ip)
  if (isIPv4(address)) return BLOCKED.check(address, IpFamily.V4)
  if (isIPv6(address)) return BLOCKED.check(address, IpFamily.V6)
  return false
}
