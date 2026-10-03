import { QUOTE_TOKEN_ORDER } from '../../core/quote-token'
import {
  ARCHETYPE_KEYS,
  CreatorShareBand,
  FeeShape,
  ThresholdBand,
} from '../../features/launchpad-economics'
import type { FilterKey } from './types'

/** Launchpads listed at once; the ranking itself covers the whole snapshot. */
export const SHOWN_LAUNCHPADS = 25

/** Select value meaning "any" for a filter. */
export const ANY = ''

/** The terms launchpads can be narrowed by, and the values each offers. */
export const FILTER_KEYS = ARCHETYPE_KEYS
export const FILTER_VALUES: Record<FilterKey, readonly string[]> = {
  quoteToken: QUOTE_TOKEN_ORDER,
  thresholdBand: Object.values(ThresholdBand),
  feeShape: Object.values(FeeShape),
  creatorShare: Object.values(CreatorShareBand),
}
