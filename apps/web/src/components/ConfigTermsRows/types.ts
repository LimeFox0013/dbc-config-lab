import type { ConfigTerms } from '../../core/config-deploy'

export interface ConfigTermsRowsProps {
  /** Rendered as `<dt>`/`<dd>` pairs inside the parent's `<dl>`. */
  terms: ConfigTerms
}
