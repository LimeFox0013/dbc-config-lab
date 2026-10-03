<template>
  <div class="comparison-table">
    <table class="comparison-table__table">
      <caption class="comparison-table__caption">
        {{ t('components.comparisonTable.caption') }}
      </caption>
      <thead>
        <tr>
          <th
            scope="col"
            class="comparison-table__head"
          >
            {{ t('components.comparisonTable.config') }}
          </th>
          <th
            scope="col"
            class="comparison-table__head comparison-table__head--number"
          >
            {{ t('components.comparisonTable.sniperProfit') }}
          </th>
          <th
            scope="col"
            class="comparison-table__head comparison-table__head--number"
          >
            {{ t('components.comparisonTable.adaptiveSniperProfit') }}
          </th>
          <th
            scope="col"
            class="comparison-table__head comparison-table__head--number"
          >
            {{ t('components.comparisonTable.humanProfit') }}
          </th>
          <th
            scope="col"
            class="comparison-table__head comparison-table__head--number"
          >
            {{ t('components.comparisonTable.humanFees') }}
          </th>
          <th
            scope="col"
            class="comparison-table__head comparison-table__head--number"
          >
            {{ t('components.comparisonTable.partnerCreatorFees') }}
          </th>
          <th
            scope="col"
            class="comparison-table__head"
          >
            {{ t('components.comparisonTable.graduated') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.entry.id"
          class="comparison-table__row"
        >
          <th
            scope="row"
            class="comparison-table__config"
          >
            <span class="comparison-table__name">{{ row.entry.name }}</span>
            <span class="comparison-table__intent">{{ row.entry.intent }}</span>
            <span
              v-if="pullable(row) > 0"
              class="comparison-table__intent comparison-table__intent--risk"
            >{{ t('common.pullable', { percent: pullable(row) }) }}</span>
            <span
              v-if="quoteOf(row) !== null && quoteOf(row) !== QuoteToken.Sol"
              class="comparison-table__intent"
            >{{ t('components.comparisonTable.pricedIn', { symbol: symbolOf(row), rate: REFERENCE_USD_PER_SOL }) }}</span>
            <span
              v-if="!keepersMigrateFor(row)"
              class="comparison-table__intent comparison-table__intent--risk"
            >{{ t('components.comparisonTable.keepersWontMigrate', { symbol: symbolOf(row), minimum: keeperMinimumOf(row) }) }}</span>
          </th>
          <template v-if="row.ok">
            <td :class="amountClass(row.metrics.sniperProfit)">
              {{ formatSolChange(row.metrics.sniperProfit) }}
            </td>
            <td :class="amountClass(row.metrics.adaptiveSniperProfit)">
              {{ formatSolChange(row.metrics.adaptiveSniperProfit) }}
            </td>
            <td :class="amountClass(row.metrics.humanProfit)">
              {{ formatSolChange(row.metrics.humanProfit) }}
            </td>
            <td class="comparison-table__amount">
              {{ formatSol(row.metrics.humanFees) }}
            </td>
            <td class="comparison-table__amount">
              {{ formatSol(row.metrics.partnerCreatorFees + row.metrics.postGraduationFees) }}
              <span
                v-if="row.metrics.postGraduationFees > 0"
                class="comparison-table__detail"
              >{{ t('components.comparisonTable.afterGraduation', { sol: formatSol(row.metrics.postGraduationFees) }) }}</span><span
                v-if="row.metrics.compoundedFees > 0"
                class="comparison-table__detail"
              >{{ t('components.comparisonTable.compounded', { sol: formatSol(row.metrics.compoundedFees) }) }}</span>
            </td>
            <td class="comparison-table__cell">
              {{ graduationText(row.metrics) }}<span
                v-if="row.metrics.liquidityPulled !== null && row.metrics.liquidityPulled > 0"
                class="comparison-table__detail"
              >{{ t('components.comparisonTable.liquidityPulled', { sol: formatSol(row.metrics.liquidityPulled) }) }}</span><span
                v-if="row.metrics.fairValueGapPercent !== null"
                class="comparison-table__detail"
              >{{
                t('components.comparisonTable.fairValue', {
                  gap: formatPercentChange(row.metrics.fairValueGapPercent),
                  arbitrage: formatSolChange(row.metrics.arbitrageProfit),
                })
              }}</span>
            </td>
          </template>
          <td
            v-else
            colspan="6"
            class="comparison-table__refused"
          >
            {{ t('common.refused', { reason: row.reason }) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { formatPercentChange, formatSol, formatSolChange } from '../../core/shared'
import { useI18n } from 'vue-i18n'
import type { ComparisonMetrics, ComparisonRow } from '../../features/comparison'
import { pullableLiquidityPercent } from '../../core/migrated-pool'
import { keepersMigrate, QUOTE_TOKENS, QuoteToken, REFERENCE_USD_PER_SOL } from '../../core/quote-token'
import type { ComparisonTableProps } from './types'

defineProps<ComparisonTableProps>()
const { t } = useI18n()

const amountClass = (sol: number): string[] => [
  'comparison-table__amount',
  sol < 0 ? 'comparison-table__amount--loss' : 'comparison-table__amount--gain',
]

const graduationText = (metrics: ComparisonMetrics): string =>
  metrics.graduationSeconds === null ?
      t('components.comparisonTable.no') :
      t('components.comparisonTable.graduatedAfter', { seconds: metrics.graduationSeconds })

const pullable = (row: ComparisonRow): number =>
  row.entry.compiled.ok ? pullableLiquidityPercent(row.entry.compiled.parameters) : 0

const quoteOf = (row: ComparisonRow): QuoteToken | null =>
  row.entry.compiled.ok ? row.entry.compiled.quoteToken : null
const symbolOf = (row: ComparisonRow): string => QUOTE_TOKENS[quoteOf(row) ?? QuoteToken.Sol].symbol
const keeperMinimumOf = (row: ComparisonRow): number =>
  QUOTE_TOKENS[quoteOf(row) ?? QuoteToken.Sol].keeperMinimumThreshold
/** Configs that cannot be compiled have nothing to migrate, so they raise no flag. */
const keepersMigrateFor = (row: ComparisonRow): boolean =>
  !row.entry.compiled.ok ||
  keepersMigrate(row.entry.compiled.parameters.migrationQuoteThreshold, row.entry.compiled.quoteToken)
</script>

<style lang="scss">
/* Wide tables scroll inside their own box instead of widening the page. */
.comparison-table {
  overflow-x: auto;
  border-radius: var(--radius-2);
}

.comparison-table__table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  color: var(--color-surface-foreground);
}

.comparison-table__caption {
  padding: var(--space-3) 0;
  text-align: left;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.comparison-table__head {
  padding: var(--space-3);
  border-bottom: var(--border-width-1) solid var(--color-border);
  text-align: left;
  font-size: var(--font-size-2);
  font-weight: var(--font-weight-strong);
  color: var(--color-muted-foreground);
}

.comparison-table__head--number {
  text-align: right;
}

.comparison-table__row + .comparison-table__row {
  border-top: var(--border-width-1) solid var(--color-border);
}

.comparison-table__config {
  padding: var(--space-3);
  text-align: left;
  font-weight: var(--font-weight-regular);
  vertical-align: top;
}

.comparison-table__name {
  display: block;
  font-weight: var(--font-weight-strong);
}

.comparison-table__intent {
  display: block;
  max-width: var(--text-max-width-narrow);
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.comparison-table__intent--risk {
  color: var(--color-loss);
}

.comparison-table__amount,
.comparison-table__cell {
  padding: var(--space-3);
  vertical-align: top;
  font-family: var(--font-family-mono);
}

.comparison-table__amount {
  text-align: right;
}

.comparison-table__cell {
  white-space: nowrap;
}

.comparison-table__amount--gain {
  color: var(--color-gain);
}

.comparison-table__amount--loss {
  color: var(--color-loss);
}

.comparison-table__detail {
  display: block;
  font-size: var(--font-size-1);
  color: var(--color-muted-foreground);
}

.comparison-table__refused {
  padding: var(--space-3);
  color: var(--color-muted-foreground);
  font-style: italic;
}
</style>
