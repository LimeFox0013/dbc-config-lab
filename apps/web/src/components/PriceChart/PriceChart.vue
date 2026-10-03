<template>
  <figure
    v-if="layout.lines.length > 0"
    ref="figure"
    class="price-chart"
  >
    <figcaption class="price-chart__title">
      {{ t('components.priceChart.title') }}
    </figcaption>
    <svg
      class="price-chart__plot"
      :viewBox="`0 0 ${width} ${CHART_SIZE.height}`"
      role="img"
      :aria-label="t('components.priceChart.description')"
    >
      <g
        v-for="tick in layout.yTicks"
        :key="`y${tick.value}`"
      >
        <line
          class="price-chart__grid"
          :x1="CHART_SIZE.padding.left"
          :x2="width - CHART_SIZE.padding.right"
          :y1="tick.position"
          :y2="tick.position"
        />
        <text
          class="price-chart__tick price-chart__tick--y"
          :x="CHART_SIZE.padding.left - TICK_GAP"
          :y="tick.position"
        >{{ t('components.priceChart.multiple', { value: formatMultiple(tick.value) }) }}</text>
      </g>
      <text
        v-for="tick in layout.xTicks"
        :key="`x${tick.value}`"
        class="price-chart__tick price-chart__tick--x"
        :x="tick.position"
        :y="CHART_SIZE.height - CHART_SIZE.padding.bottom + TICK_LABEL_OFFSET"
      >{{ t('components.priceChart.seconds', { value: tick.value }) }}</text>
      <g
        v-for="line in layout.lines"
        :key="line.id"
      >
        <polyline
          :class="lineClass(line)"
          :points="line.points"
        />
        <circle
          v-if="line.graduation"
          :class="`price-chart__marker price-chart__marker--series-${line.color}`"
          :cx="line.graduation.x"
          :cy="line.graduation.y"
          :r="MARKER_RADIUS"
        />
      </g>
    </svg>
    <ul class="price-chart__legend">
      <li
        v-for="line in layout.lines"
        :key="line.id"
        class="price-chart__entry"
      >
        <svg
          class="price-chart__swatch"
          viewBox="0 0 24 8"
          aria-hidden="true"
        >
          <line
            :class="lineClass(line)"
            x1="0"
            y1="4"
            x2="24"
            y2="4"
          />
        </svg>
        <span>{{ legendText(line) }}</span>
      </li>
    </ul>
  </figure>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CHART_SIZE,
  MARKER_RADIUS,
  TICK_GAP,
  TICK_LABEL_OFFSET,
} from './constants'
import type { ChartLine, PriceChartProps } from './types'
import { chartLayout } from './utils'

const props = defineProps<PriceChartProps>()
const { t } = useI18n()

const figure = ref<HTMLElement | null>(null)
const width = ref<number>(CHART_SIZE.width)
const observer = new ResizeObserver(([entry]) => {
  if (entry) width.value = Math.round(entry.contentRect.width)
})
// The figure renders only while some config is simulated, so follow the element itself.
watch(figure, (element, previous) => {
  if (previous) observer.unobserve(previous)
  if (element) observer.observe(element)
})
onBeforeUnmount(() => observer.disconnect())

const layout = computed(() =>
  chartLayout(
    props.rows.flatMap((row) =>
      row.ok ?
          [
            {
              id: row.entry.id,
              name: row.entry.name,
              path: row.path,
              graduationSeconds: row.metrics.graduationSeconds,
            },
          ] :
          [],
    ),
    width.value,
  ),
)

const multipleFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 })
const formatMultiple = (value: number): string => multipleFormat.format(value)

const lineClass = (line: ChartLine): string[] => [
  'price-chart__line',
  `price-chart__line--series-${line.color}`,
  `price-chart__line--dash-${line.dash}`,
]

const legendText = (line: ChartLine): string =>
  t('components.priceChart.legend', {
    name: line.name,
    peak: formatMultiple(line.peak),
    final: formatMultiple(line.final),
    graduation:
      line.graduationSeconds === null ?
          t('components.priceChart.notGraduated') :
          t('components.priceChart.graduatedAt', { seconds: line.graduationSeconds }),
  })
</script>

<style lang="scss">
.price-chart {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding: var(--space-4);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-surface);
  color: var(--color-surface-foreground);
}

.price-chart__title {
  font-size: var(--font-size-3);
  font-weight: 600;
}

.price-chart__plot {
  display: block;
  width: 100%;
  height: auto;
}

.price-chart__grid {
  stroke: var(--color-border);
  stroke-width: var(--chart-grid-width);
}

.price-chart__tick {
  font-family: var(--font-family);
  font-size: var(--font-size-1);
  fill: var(--color-muted-foreground);
}

.price-chart__tick--y {
  text-anchor: end;
  dominant-baseline: middle;
}

.price-chart__tick--x {
  text-anchor: middle;
}

.price-chart__line {
  fill: none;
  stroke-width: var(--chart-line-width);
  stroke-linejoin: round;
}

.price-chart__line--dash-2 {
  stroke-dasharray: var(--chart-dash-2);
}

.price-chart__line--dash-3 {
  stroke-dasharray: var(--chart-dash-3);
}

.price-chart__marker {
  stroke: var(--color-surface);
  stroke-width: var(--chart-grid-width);
}

@for $i from 1 through 6 {
  .price-chart__line--series-#{$i} {
    stroke: var(--color-series-#{$i});
  }

  .price-chart__marker--series-#{$i} {
    fill: var(--color-series-#{$i});
  }
}

.price-chart__legend {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--font-size-2);
}

.price-chart__entry {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.price-chart__swatch {
  flex: none;
  width: var(--space-6);
  height: var(--space-2);
}
</style>
