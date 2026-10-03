import { CHART_SIZE, SERIES_COLORS, SERIES_DASHES } from './constants'
import type { ChartLayout, ChartSeries, ChartTick } from './types'

const { height, padding } = CHART_SIZE
const innerHeight = height - padding.top - padding.bottom

const round = (value: number): string => value.toFixed(1)

/**
 * Lays out price paths: seconds on x, the price multiple on a log₁₀ y axis whose range
 * always includes the opening price (1×) and spans at least one decade.
 */
export const chartLayout = (
  series: ChartSeries[],
  width: number,
): ChartLayout => {
  const innerWidth = Math.max(1, width - padding.left - padding.right)
  const points = series.flatMap((s) => s.path)
  const maxAt = Math.max(1, ...points.map((p) => p.at))
  const logs = points.map((p) => Math.log10(p.multiple))
  const low = Math.floor(Math.min(0, ...logs))
  const high = Math.max(low + 1, Math.ceil(Math.max(0, ...logs)))

  const x = (at: number): number => padding.left + (at / maxAt) * innerWidth
  const y = (multiple: number): number =>
    padding.top + ((high - Math.log10(multiple)) / (high - low)) * innerHeight

  const lines = series.map((s, index) => {
    const graduated =
      s.graduationSeconds === null
        ? undefined
        : s.path.find((p) => p.at >= (s.graduationSeconds ?? 0))
    const multiples = s.path.map((p) => p.multiple)
    return {
      id: s.id,
      name: s.name,
      color: (index % SERIES_COLORS) + 1,
      dash: (index % SERIES_DASHES) + 1,
      points: s.path
        .map((p) => `${round(x(p.at))},${round(y(p.multiple))}`)
        .join(' '),
      graduation: graduated
        ? { x: x(graduated.at), y: y(graduated.multiple) }
        : null,
      peak: Math.max(...multiples),
      final: multiples[multiples.length - 1] ?? 1,
      graduationSeconds: s.graduationSeconds,
    }
  })

  const yTicks: ChartTick[] = Array.from({ length: high - low + 1 }, (_, i) => {
    const value = 10 ** (low + i)
    return { position: y(value), value }
  })
  const xTicks: ChartTick[] = [0, Math.round(maxAt / 2), maxAt].map(
    (value) => ({
      position: x(value),
      value,
    }),
  )
  return { lines, xTicks, yTicks }
}
