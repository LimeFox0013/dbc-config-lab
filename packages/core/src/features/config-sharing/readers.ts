/**
 * Small runtime validators for untrusted JSON. Each reader returns a freshly built value
 * or throws a `ReadError` naming the path of the offending field. Objects are read field by
 * field by typed readers (see document.ts) and rebuilt from those fields only, so unknown
 * keys never survive.
 */
import type { Reader } from './types'
import { isRecord } from '../../core/shared'
export class ReadError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`)
  }
}

export const finiteNumber: Reader<number> = (value, path) => {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new ReadError(path, 'expected a number')
  return value
}

export const boolean: Reader<boolean> = (value, path) => {
  if (typeof value !== 'boolean')
    throw new ReadError(path, 'expected true or false')
  return value
}

export const text =
  (maxLength: number): Reader<string> =>
  (value, path) => {
    if (typeof value !== 'string' || value.length > maxLength)
      throw new ReadError(path, `expected text up to ${maxLength} characters`)
    return value
  }

/** One of an enum's values; `values` must be the enum's own values. */
export const oneOf =
  <E extends string | number>(values: readonly E[]): Reader<E> =>
  (value, path) => {
    const match = values.find((v) => v === value)
    if (match === undefined) throw new ReadError(path, 'unexpected value')
    return match
  }

export const arrayOf =
  <T>(item: Reader<T>, maxLength: number): Reader<T[]> =>
  (value, path) => {
    if (!Array.isArray(value) || value.length > maxLength)
      throw new ReadError(path, `expected a list of at most ${maxLength}`)
    return value.map((v, i) => item(v, `${path}[${i}]`))
  }

/** The value as a plain object, ready for field-by-field reading. */
export const record = (
  value: unknown,
  path: string,
): Record<string, unknown> => {
  if (!isRecord(value)) throw new ReadError(path, 'expected an object')
  return value
}

/** A field that may be absent; present values must pass `reader`. */
export const optional =
  <T>(reader: Reader<T>): Reader<T | undefined> =>
  (value, path) =>
    value === undefined ? undefined : reader(value, path)
