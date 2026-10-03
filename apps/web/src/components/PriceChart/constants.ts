/**
 * Chart coordinate system. The plot is laid out at its rendered pixel width, so SVG units
 * are pixels and text keeps its token size; `width` is used until the first measurement.
 */
export const CHART_SIZE = {
  width: 640,
  height: 260,
  padding: { top: 12, right: 16, bottom: 28, left: 52 },
} as const

/** Number of series colour tokens (--color-series-N) and dash styles (--chart-dash-N). */
export const SERIES_COLORS = 6
export const SERIES_DASHES = 3

/** SVG units between the x axis and its labels, and between the y axis and its labels. */
export const TICK_LABEL_OFFSET = 18
export const TICK_GAP = 6

/** Graduation dot radius, in SVG units (an attribute: CSS `r` is not supported everywhere). */
export const MARKER_RADIUS = 4
