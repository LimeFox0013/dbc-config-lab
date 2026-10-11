// ── SSRF Error Codes ──────────────────────────────────────────────────────────

/**
 * Error codes returned when a URL fails the SSRF safety check.
 */
export enum SsrfErrorCode {
  /** URL could not be parsed as a valid URL. */
  ERR_INVALID_URL = 'ERR_INVALID_URL',
  /** Protocol is not http: or https:. */
  ERR_PROTOCOL_FORBIDDEN = 'ERR_PROTOCOL_FORBIDDEN',
  /** Hostname resolves to a private or reserved IP address. */
  ERR_PRIVATE_IP = 'ERR_PRIVATE_IP',
  /** DNS lookup for the hostname failed. */
  ERR_DNS_FAILURE = 'ERR_DNS_FAILURE',
}

// ── Network Constants ─────────────────────────────────────────────────────────

/** Protocols that are safe to use in outbound requests. */
export const ALLOWED_PROTOCOLS = ['http:', 'https:'] as const

/** Timeout in milliseconds for network requests. */
export const SAFE_FETCH_TIMEOUT_MS = 5_000

// ── Blocked address ranges ────────────────────────────────────────────────────

/** Address families as named by `node:net` (`BlockList`, `isIP`). */
export enum IpFamily {
  V4 = 'ipv4',
  V6 = 'ipv6',
}

/** IPv4 ranges an outbound request must never reach (IANA special-purpose registry). */
export const BLOCKED_IPV4_SUBNETS = [
  { network: '0.0.0.0', prefix: 8 }, // "this network"
  { network: '10.0.0.0', prefix: 8 }, // RFC 1918
  { network: '100.64.0.0', prefix: 10 }, // CGNAT shared address space
  { network: '127.0.0.0', prefix: 8 }, // loopback
  { network: '169.254.0.0', prefix: 16 }, // link-local (cloud metadata)
  { network: '172.16.0.0', prefix: 12 }, // RFC 1918
  { network: '192.0.0.0', prefix: 24 }, // IETF protocol assignments
  { network: '192.168.0.0', prefix: 16 }, // RFC 1918
  { network: '198.18.0.0', prefix: 15 }, // benchmarking
  { network: '224.0.0.0', prefix: 4 }, // multicast
  { network: '240.0.0.0', prefix: 4 }, // reserved, incl. 255.255.255.255 broadcast
] as const

/** IPv6 ranges an outbound request must never reach. */
export const BLOCKED_IPV6_SUBNETS = [
  { network: '::', prefix: 96 }, // unspecified, loopback, deprecated IPv4-compatible
  { network: 'fc00::', prefix: 7 }, // unique local
  { network: 'fe80::', prefix: 10 }, // link-local
  { network: 'ff00::', prefix: 8 }, // multicast
] as const

/** /96 IPv6 prefixes whose low 32 bits carry an IPv4 address (mapped, NAT64). */
export const IPV4_EMBEDDING_IPV6_PREFIXES = ['::ffff:', '64:ff9b::'] as const
