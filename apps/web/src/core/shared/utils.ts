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
