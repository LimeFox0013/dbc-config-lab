import type { SsrfErrorCode } from './constants.js'
import type { LookupAddress } from 'node:dns'

/**
 * Structured error returned when a URL is blocked by SSRF safeguards.
 * Never thrown — callers narrow on this type directly.
 */
export interface SsrfError {
  readonly code: SsrfErrorCode
  readonly message: string
}

/** A CIDR block: network address plus prefix length. */
export interface Subnet {
  readonly network: string
  readonly prefix: number
}

/** The non-empty, fully vetted address list a hostname resolved to. */
export type ResolvedAddresses = readonly [LookupAddress, ...LookupAddress[]]
