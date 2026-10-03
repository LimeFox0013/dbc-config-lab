import type { LaunchConfig } from '../../core/launch-config'
import type { ShareRejection } from './constants'

export interface SharedConfig {
  config: LaunchConfig
  name?: string
}

export type DecodeResult =
  | { ok: true; shared: SharedConfig }
  | { ok: false; rejection: ShareRejection; detail?: string }

/** Reads one field of untrusted input as `T`, or throws naming its path. */
export type Reader<T> = (value: unknown, path: string) => T
