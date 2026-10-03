import type { ConfigTerms } from '../../core/config-deploy'

export interface ConfigTermsRowsProps {
  /** Rendered as `<dt>`/`<dd>` pairs inside the parent's `<dl>`. */
  terms: ConfigTerms
}

import type { DURATION_UNITS } from './constants'

export type DurationUnit = (typeof DURATION_UNITS)[number]['unit']
