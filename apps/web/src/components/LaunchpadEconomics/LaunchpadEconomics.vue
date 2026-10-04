<template>
  <details
    class="launchpad-economics"
    @toggle="onToggle"
  >
    <summary class="launchpad-economics__summary">
      {{ t('components.launchpadEconomics.title') }}
    </summary>
    <p class="launchpad-economics__hint">
      {{ t('components.launchpadEconomics.intro') }}
    </p>
    <p
      v-if="open && !records"
      class="launchpad-economics__hint"
    >
      {{ t('components.launchpadEconomics.loading') }}
    </p>
    <template v-else-if="records">
      <div class="launchpad-economics__controls">
        <label class="launchpad-economics__field">
          <span class="launchpad-economics__label">{{ t('components.launchpadEconomics.sortBy') }}</span>
          <select
            v-model="sort"
            class="launchpad-economics__select"
          >
            <option
              v-for="option in Object.values(LaunchpadSort)"
              :key="option"
              :value="option"
            >
              {{ t(`components.launchpadEconomics.sorts.${option}`) }}
            </option>
          </select>
        </label>
        <label
          v-for="key in FILTER_KEYS"
          :key="key"
          class="launchpad-economics__field"
        >
          <span class="launchpad-economics__label">{{ t(`components.launchpadEconomics.filters.${key}`) }}</span>
          <select
            class="launchpad-economics__select"
            :value="filter[key] ?? ANY"
            @change="setFilter(key, $event)"
          >
            <option :value="ANY">
              {{ t('components.launchpadEconomics.any') }}
            </option>
            <option
              v-for="value in FILTER_VALUES[key]"
              :key="value"
              :value="value"
            >
              {{ t(`common.launchpadTerms.${key}.${value}`) }}
            </option>
          </select>
        </label>
      </div>
      <p class="launchpad-economics__hint">
        {{ t('components.launchpadEconomics.matching', { shown: shown.length, total: ranked.length, date: takenAt }) }}
      </p>
      <div class="launchpad-economics__scroll">
        <table class="launchpad-economics__table">
          <thead>
            <tr>
              <th scope="col">
                {{ t('components.launchpadEconomics.columns.launchpad') }}
              </th>
              <th
                scope="col"
                class="launchpad-economics__number"
              >
                {{ t('components.launchpadEconomics.columns.partnerIncome') }}
              </th>
              <th
                scope="col"
                class="launchpad-economics__number"
              >
                {{ t('components.launchpadEconomics.columns.afterGraduation') }}
              </th>
              <th
                scope="col"
                class="launchpad-economics__number"
              >
                {{ t('components.launchpadEconomics.columns.launches') }}
              </th>
              <th
                scope="col"
                class="launchpad-economics__number"
              >
                {{ t('components.launchpadEconomics.columns.graduated') }}
              </th>
              <th scope="col">
                {{ t('components.launchpadEconomics.columns.terms') }}
              </th>
              <th scope="col">
                <span class="launchpad-economics__hidden">{{ t('components.launchpadEconomics.columns.actions') }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="record in shown"
              :key="record.config.configAddress"
            >
              <th scope="row">
                <a
                  :href="explorerAddressUrl(record.config.configAddress, record.config.network)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="launchpad-economics__link"
                >{{ shortAddress(record.config.configAddress) }}</a>
              </th>
              <td class="launchpad-economics__number">
                {{ t('components.launchpadEconomics.income', { median: formatSol(record.partnerIncomeMedian), p75: formatSol(record.partnerIncomeP75) }) }}
              </td>
              <td class="launchpad-economics__number">
                {{ afterText(record) }}
              </td>
              <td class="launchpad-economics__number">
                {{ formatCount(record.launches) }}
              </td>
              <td class="launchpad-economics__number">
                {{ formatShare(graduationRate(record)) }}
              </td>
              <td class="launchpad-economics__terms">
                {{ termsText(record) }}
                <span
                  v-if="pullableLiquidityPercent(record.config.parameters) > 0"
                  class="launchpad-economics__risk"
                >{{ t('common.pullable', { percent: pullableLiquidityPercent(record.config.parameters) }) }}</span>
              </td>
              <td>
                <button
                  type="button"
                  class="launchpad-economics__button"
                  :disabled="migratedUnsupportedReason(record.config.parameters) !== null"
                  @click="emit('compare', record.config)"
                >
                  {{ t('components.launchpadEconomics.compare') }}
                </button>
                <RouterLink
                  :to="reportPagePath(record.config.configAddress, record.config.network)"
                  class="launchpad-economics__report"
                >
                  {{ t('components.launchpadEconomics.report') }}
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="launchpad-economics__hint">
        {{ t('components.launchpadEconomics.curveOnly') }}
      </p>
    </template>
  </details>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { explorerAddressUrl } from '../../core/config-deploy'
import { reportPagePath } from '../../features/launch-page'
import { migratedUnsupportedReason, pullableLiquidityPercent } from '../../core/migrated-pool'
import { QUOTE_TOKENS, wholeQuoteTokens } from '../../core/quote-token'
import { formatAmount, formatCount, formatShare, formatSol, shortAddress } from '../../core/shared'
import { AfterGraduationBasis, graduationRate, LaunchpadSort, rankLaunchpads, useLaunchpadSnapshot } from '../../features/launchpad-economics'
import type { LaunchpadFilter, LaunchpadRecord } from '../../features/launchpad-economics'
import type { OnChainConfig } from '../../features/onchain-config'
import { ANY, FILTER_KEYS, FILTER_VALUES, SHOWN_LAUNCHPADS } from './constants'
import type { FilterKey } from './types'

const emit = defineEmits<{ compare: [config: OnChainConfig] }>()
const { t } = useI18n()

const { open, records, takenAt, onToggle } = useLaunchpadSnapshot()

const sort = ref<LaunchpadSort>(LaunchpadSort.PartnerIncome)
const filter = ref<LaunchpadFilter>({})
const setFilter = (key: FilterKey, event: Event): void => {
  if (!(event.target instanceof HTMLSelectElement)) return
  const value = event.target.value
  // An unset key (the "any" option) matches every launchpad.
  filter.value = { ...filter.value, [key]: FILTER_VALUES[key].find((v) => v === value) }
}

const ranked = computed(() =>
  records.value ? rankLaunchpads(records.value, { sort: sort.value, filter: filter.value }) : [],
)
const shown = computed(() => ranked.value.slice(0, SHOWN_LAUNCHPADS))

/** Income after graduation per launch, or why there is none to show. */
const afterText = (record: LaunchpadRecord): string => {
  const after = record.afterGraduation
  if (!after) return t('components.launchpadEconomics.after.unknown')
  switch (after.basis) {
    case AfterGraduationBasis.NoShare:
      return t('components.launchpadEconomics.after.noShare')
    case AfterGraduationBasis.NotHeld:
      return t('components.launchpadEconomics.after.notHeld')
    case AfterGraduationBasis.Positions:
      return t('components.launchpadEconomics.after.positions', {
        median: formatSol(after.median),
        p75: formatSol(after.p75),
        positions: formatCount(after.sampledPositions),
      })
  }
}

const termsText = (record: LaunchpadRecord): string => {
  const { parameters, quoteToken } = record.config
  return t('components.launchpadEconomics.terms', {
    threshold: formatAmount(wholeQuoteTokens(parameters.migrationQuoteThreshold, quoteToken)),
    symbol: QUOTE_TOKENS[quoteToken].symbol,
    fee: t(`common.launchpadTerms.feeShape.${record.archetype.feeShape}`),
    creator: parameters.creatorTradingFeePercentage,
  })
}
</script>

<style lang="scss">
@use '../../styles/mixins';

.launchpad-economics {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  @include mixins.surface;
}

.launchpad-economics__summary {
  cursor: pointer;
  font-size: var(--font-size-3);
  font-weight: var(--font-weight-strong);
}

.launchpad-economics__hint {
  margin: var(--space-2) 0 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.launchpad-economics__controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.launchpad-economics__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.launchpad-economics__label {
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.launchpad-economics__select,
.launchpad-economics__button {
  @include mixins.control;
}

.launchpad-economics__button {
  @include mixins.clickable;
}

.launchpad-economics__scroll {
  overflow-x: auto;
}

.launchpad-economics__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-2);

  th,
  td {
    padding: var(--space-2);
    border-bottom: var(--border-width-1) solid var(--color-border);
    text-align: left;
    vertical-align: top;
  }
}

.launchpad-economics__number {
  font-family: var(--font-family-mono);
  text-align: right;
  white-space: nowrap;
}

.launchpad-economics__terms {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: var(--text-min-width-terms);
}

.launchpad-economics__risk {
  color: var(--color-loss);
}

.launchpad-economics__link {
  color: var(--color-gain);
  font-family: var(--font-family-mono);
}

.launchpad-economics__hidden {
  @include mixins.visually-hidden;
}
.launchpad-economics__report {
  margin-left: var(--space-2);
  color: var(--color-gain);
  font-size: var(--font-size-2);
  white-space: nowrap;
}
</style>
