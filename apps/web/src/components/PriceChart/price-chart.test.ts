import { describe, expect, it } from 'vitest'
import { CHART_SIZE } from './constants'
import type { ChartSeries } from './types'
import { chartLayout } from './utils'

const series = (
  id: string,
  path: [number, number][],
  graduationSeconds: number | null = null,
): ChartSeries => ({
  id,
  name: id,
  path: path.map(([at, multiple]) => ({ at, multiple })),
  graduationSeconds,
})

const layout = (all: ChartSeries[]) => chartLayout(all, CHART_SIZE.width)

describe('chartLayout', () => {
  it('spans from the opening price to the highest decade reached, on a log scale', () => {
    const { yTicks } = layout([
      series('a', [
        [0, 1],
        [10, 40],
        [20, 3],
      ]),
    ])
    expect(yTicks.map((t) => t.value)).toEqual([1, 10, 100])
    expect(yTicks[0]?.position).toBeCloseTo(
      CHART_SIZE.height - CHART_SIZE.padding.bottom,
    )
    expect(yTicks[2]?.position).toBeCloseTo(CHART_SIZE.padding.top)
  })

  it('reaches below the opening price when a launch crashes under it', () => {
    const { yTicks } = layout([
      series('a', [
        [0, 1],
        [5, 0.05],
      ]),
    ])
    expect(yTicks.map((t) => t.value)).toEqual([0.01, 0.1, 1])
  })

  it('reports peak and final price and marks graduation at the first trade after it', () => {
    const [line] = layout([
      series(
        'a',
        [
          [0, 1],
          [10, 40],
          [66, 30],
          [80, 3],
        ],
        66,
      ),
    ]).lines
    expect(line?.peak).toBe(40)
    expect(line?.final).toBe(3)
    expect(line?.graduation).not.toBeNull()
  })

  it('gives neighbouring lines different colours and dash patterns', () => {
    const { lines } = layout([series('a', [[0, 1]]), series('b', [[0, 1]])])
    expect(lines[0]?.color).not.toBe(lines[1]?.color)
    expect(lines[0]?.dash).not.toBe(lines[1]?.dash)
  })

  it('stretches the time axis to the width it is drawn at', () => {
    const narrow = chartLayout(
      [
        series('a', [
          [0, 1],
          [100, 2],
        ]),
      ],
      320,
    )
    const last = narrow.xTicks[narrow.xTicks.length - 1]
    expect(last?.position).toBeCloseTo(320 - CHART_SIZE.padding.right)
  })
})
