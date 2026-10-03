import type { ComparisonEntry } from '../../features/comparison'

export interface IncomeForecastProps {
  /** Every config in the comparison; those that compile can be forecast. */
  entries: ComparisonEntry[]
}
