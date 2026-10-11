import type { ComparisonEntry } from '@dbc-config-lab/core/features/comparison'

export interface IncomeForecastProps {
  /** Every config in the comparison; those that compile can be forecast. */
  entries: ComparisonEntry[]
}
