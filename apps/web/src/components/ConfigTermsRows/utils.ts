import { DURATION_UNITS } from './constants'
import type { DurationUnit } from './types'

/** A duration in the largest unit it fills at least once, to one decimal. */
export const durationParts = (
  seconds: number,
): { value: number; unit: DurationUnit } => {
  const fit =
    DURATION_UNITS.find((candidate) => seconds >= candidate.seconds) ??
    DURATION_UNITS[DURATION_UNITS.length - 1]
  return {
    value: Math.round((seconds / fit.seconds) * 10) / 10,
    unit: fit.unit,
  }
}
