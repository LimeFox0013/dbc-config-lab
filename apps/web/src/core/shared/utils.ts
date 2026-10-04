import { PublicKey } from '@solana/web3.js'
import { ADDRESS_EDGE, MAX_ADDRESS_LENGTH } from './constants'
/** A thrown value as readable text. */
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** `value` within [min, max]; anything that is not a finite number becomes `min`. */
export const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min

/** A type guard for membership of a numeric enum, given the enum's values. */
export const isEnumValue =
  <E extends number>(values: readonly unknown[]) =>
  (value: number): value is E =>
    values.includes(value)

/**
 * A deep copy of JSON-safe data (plain objects, arrays, numbers, strings, booleans, null).
 * Also strips framework proxies, which cannot be posted to a worker. Not for BN, Date,
 * Map or class instances.
 */
export const plainCopy = <T>(value: T): T => {
  const copy: T = JSON.parse(JSON.stringify(value))
  return copy
}

/** An address shortened for display, e.g. "DrkD…Kt5D". */
export const shortAddress = (address: string): string =>
  `${address.slice(0, ADDRESS_EDGE)}…${address.slice(-ADDRESS_EDGE)}`

/** A plain object, as untrusted JSON may or may not contain one. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Up to `limit` items spread evenly over `items`, first one included; all of them if fewer. */
export const evenSample = <T>(items: readonly T[], limit: number): T[] => {
  if (items.length <= limit) return [...items]
  const step = items.length / limit
  return Array.from(
    { length: limit },
    (_, i) => items[Math.floor(i * step)],
  ).filter((item): item is T => item !== undefined)
}

/** `items` in consecutive groups of at most `size`. */
export const chunks = <T>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  )

/** A Solana address typed by someone, or null when it is not one. */
export const parseAddress = (raw: string): PublicKey | null => {
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_ADDRESS_LENGTH) return null
  try {
    return new PublicKey(trimmed)
  } catch {
    return null
  }
}
