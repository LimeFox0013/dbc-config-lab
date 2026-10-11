import type { ConfigTerms } from '@dbc-config-lab/core/core/config-deploy'
import type { DURATION_UNITS } from './constants'

export interface ConfigTermsRowsProps {
  /** Rendered as `<dt>`/`<dd>` pairs inside the parent's `<dl>`. */
  terms: ConfigTerms
}

export type DurationUnit = (typeof DURATION_UNITS)[number]['unit']
