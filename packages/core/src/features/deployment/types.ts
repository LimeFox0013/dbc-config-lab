import type { ComparisonEntry } from '../comparison'
import type { PresetRoyalty } from '../../core/preset-royalty'

/**
 * A config the user can deploy — a built-in or edited preset, or a clone of a real one —
 * with its author's share of the launchpad's fees (null when none).
 */
export type DeployTarget = ComparisonEntry & { royalty: PresetRoyalty | null }

/** What building a transaction gave: it, or why not — null when the screen words the reason itself. */
export type PreparationOutcome<P> =
  { ok: true; prepared: P } | { ok: false; reason: string | null }
