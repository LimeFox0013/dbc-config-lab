import { createHash, randomBytes } from 'crypto'
import type { Provider, Type } from '@nestjs/common'
import {
  AGENTIC_ACCOUNT_KEY_PREFIX,
  BEARER_SCHEME_PREFIX,
  KEY_DISPLAY_PREFIX_LENGTH,
  KEY_DISPLAY_PREFIX_SUFFIX,
  KEY_ENTROPY_BYTES,
  KEY_HASH_ALGORITHM,
} from './constants.js'

/** A fresh raw key: the `agt_` prefix followed by hex-encoded random bytes. */
export const generateAgenticKey = (): string =>
  `${AGENTIC_ACCOUNT_KEY_PREFIX}${randomBytes(KEY_ENTROPY_BYTES).toString('hex')}`

/** The hash a raw key is stored and looked up by. */
export const hashAgenticKey = (rawKey: string): string =>
  createHash(KEY_HASH_ALGORITHM).update(rawKey).digest('hex')

/** The non-secret leading part of a raw key, safe to persist and display. */
export const toKeyDisplayPrefix = (rawKey: string): string =>
  `${rawKey.substring(0, KEY_DISPLAY_PREFIX_LENGTH)}${KEY_DISPLAY_PREFIX_SUFFIX}`

/** The token of a `Bearer` `Authorization` header, or `undefined` for anything else. */
export const readBearerToken = (header: unknown): string | undefined =>
  typeof header === 'string' && header.startsWith(BEARER_SCHEME_PREFIX)
    ? header.slice(BEARER_SCHEME_PREFIX.length)
    : undefined

/** A DI provider for `token` from either a class (`useClass`) or a ready value (`useValue`). */
export const toProvider = <T>(
  token: string,
  classOrValue: Type<T> | T,
): Provider =>
  typeof classOrValue === 'function'
    ? { provide: token, useClass: classOrValue as Type<T> }
    : { provide: token, useValue: classOrValue }
