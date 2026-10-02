import type { LaunchConfig } from '../../core/launch-config'
import type { ShareRejection } from './constants'

export interface SharedConfig {
  config: LaunchConfig
  name?: string
}

export type DecodeResult =
  | { ok: true; shared: SharedConfig }
  | { ok: false; rejection: ShareRejection; detail?: string }
