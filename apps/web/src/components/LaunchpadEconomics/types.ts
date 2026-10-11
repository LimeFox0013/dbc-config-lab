import type { ARCHETYPE_KEYS } from '@dbc-config-lab/core/features/launchpad-economics'

/** A term launchpads can be narrowed by. */
export type FilterKey = (typeof ARCHETYPE_KEYS)[number]
