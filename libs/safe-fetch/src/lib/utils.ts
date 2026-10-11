import type { SsrfError } from './types.js'

/** `URL#hostname` keeps the brackets around an IPv6 literal; DNS and `node:net` want them off. */
export const stripIpv6Brackets = (host: string): string =>
  host.replace(/^\[(.*)\]$/, '$1')

/** Narrow a `Response | SsrfError`-style union (or any value) to an `SsrfError`. */
export const isSsrfError = (value: unknown): value is SsrfError =>
  typeof value === 'object' &&
  value !== null &&
  'code' in value &&
  'message' in value
