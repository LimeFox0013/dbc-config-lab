import type { CompiledLaunchConfig } from '../../core/launch-config'

/** A config the user can deploy: a built-in or edited preset, or a clone of a real one. */
export interface DeployTarget {
  id: string
  name: string
  compiled: CompiledLaunchConfig
}

/** What building a transaction gave: it, or why not — null when the screen words the reason itself. */
export type PreparationOutcome<P> =
  { ok: true; prepared: P } | { ok: false; reason: string | null }
