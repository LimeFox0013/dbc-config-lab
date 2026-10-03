import type { ComparisonRow, PricePoint } from '../../features/comparison'

export interface PriceChartProps {
  rows: ComparisonRow[]
}

export interface ChartSeries {
  id: string
  name: string
  path: PricePoint[]
  graduationSeconds: number | null
}

export interface ChartLine {
  id: string
  name: string
  /** 1-based, for the --color-series-N token. */
  color: number
  /** 1-based; 1 is solid, others use --chart-dash-N. */
  dash: number
  points: string
  graduation: { x: number; y: number } | null
  peak: number
  final: number
  graduationSeconds: number | null
}

export interface ChartTick {
  position: number
  value: number
}

export interface ChartLayout {
  lines: ChartLine[]
  xTicks: ChartTick[]
  yTicks: ChartTick[]
}
