<template>
  <details
    class="preset-catalog"
    @toggle="onToggle"
  >
    <summary class="preset-catalog__summary">
      {{ t('components.presetCatalog.title') }}
    </summary>
    <p class="preset-catalog__hint">
      {{ t('components.presetCatalog.intro', { date: takenAt }) }}
    </p>
    <ul
      v-if="open"
      class="preset-catalog__list"
    >
      <li
        v-for="preset in LAUNCH_PRESETS"
        :key="preset.id"
        class="preset-catalog__entry"
      >
        <span class="preset-catalog__name">{{ preset.name }}</span>
        <span class="preset-catalog__text">{{ preset.intent }}</span>
        <span class="preset-catalog__outcome">{{ outcomeText(preset.id) }}</span>
        <button
          type="button"
          class="preset-catalog__button"
          @click="emit('adopt', preset)"
        >
          {{ t('components.presetCatalog.editCopy') }}
        </button>
      </li>
      <li
        v-for="launchpad in launchpads"
        :key="launchpad.config.configAddress"
        class="preset-catalog__entry"
      >
        <span class="preset-catalog__name">
          {{ t('components.presetCatalog.launchpadName', { address: shortAddress(launchpad.config.configAddress) }) }}
          <a
            :href="explorerAddressUrl(launchpad.config.configAddress, launchpad.config.network)"
            target="_blank"
            rel="noopener noreferrer"
            class="preset-catalog__link"
          >{{ t('components.presetCatalog.view') }}</a>
        </span>
        <span class="preset-catalog__text">
          {{
            t('components.presetCatalog.record', {
              graduated: formatCount(launchpad.graduated),
              launches: formatCount(launchpad.launches),
              date: launchpad.takenAt,
            })
          }}
        </span>
        <span class="preset-catalog__text">{{ termsText(launchpad) }}</span>
        <span
          v-if="pullableLiquidityPercent(launchpad.config.parameters) > 0"
          class="preset-catalog__text preset-catalog__text--risk"
        >{{ t('common.pullable', { percent: pullableLiquidityPercent(launchpad.config.parameters) }) }}</span>
        <span class="preset-catalog__outcome">{{ outcomeText(launchpad.config.configAddress) }}</span>
        <button
          type="button"
          class="preset-catalog__button"
          @click="emit('compare', launchpad.config)"
        >
          {{ t('components.presetCatalog.compare') }}
        </button>
      </li>
    </ul>
  </details>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { explorerAddressUrl } from '../../core/config-deploy'
import { LAUNCH_PRESETS } from '../../core/launch-config'
import type { LaunchPreset } from '../../core/launch-config'
import { migratedUnsupportedReason, pullableLiquidityPercent } from '../../core/migrated-pool'
import { QUOTE_TOKENS, wholeQuoteTokens } from '../../core/quote-token'
import { formatAmount, formatCount, formatSolChange, shortAddress } from '../../core/shared'
import { compareConfigs, parametersEntry, presetEntry } from '../../features/comparison'
import type { ComparisonEntry } from '../../features/comparison'
import type { OnChainConfig } from '../../features/onchain-config'
import { useLaunchpadSnapshot } from '../../features/launchpad-economics'
import type { LaunchpadRecord } from '../../features/launchpad-economics'
import { CATALOG_LAUNCHPADS } from './constants'
import type { PresetCatalogProps } from './types'

const props = defineProps<PresetCatalogProps>()
const emit = defineEmits<{ adopt: [preset: LaunchPreset], compare: [config: OnChainConfig] }>()
const { t } = useI18n()

/** Entries are only loaded and simulated while the catalogue is open. */
const { open, records, takenAt, onToggle } = useLaunchpadSnapshot()
/** The most-graduated real launchpads the simulator reproduces. */
const launchpads = computed(() =>
  [...(records.value ?? [])]
    .filter((r) => migratedUnsupportedReason(r.config.parameters) === null)
    .sort((a, b) => b.graduated - a.graduated)
    .slice(0, CATALOG_LAUNCHPADS),
)

const launchpadEntry = (launchpad: LaunchpadRecord): ComparisonEntry =>
  parametersEntry(
    { id: launchpad.config.configAddress, name: launchpad.config.configAddress, intent: '' },
    launchpad.config.parameters,
    launchpad.config.quoteToken,
  )

const rows = computed(() =>
  open.value ?
      compareConfigs([...LAUNCH_PRESETS.map(presetEntry), ...launchpads.value.map(launchpadEntry)], props.scenario) :
      [],
)

const outcomeText = (id: string): string => {
  const row = rows.value.find((r) => r.entry.id === id)
  if (!row) return ''
  if (!row.ok) return t('common.refused', { reason: row.reason })
  const { metrics } = row
  return t('components.presetCatalog.outcome', {
    snipers: formatSolChange(metrics.sniperProfit + metrics.adaptiveSniperProfit),
    humans: formatSolChange(metrics.humanProfit),
    graduation: metrics.graduationSeconds === null ?
        t('components.presetCatalog.notGraduated') :
        t('components.presetCatalog.graduatedAfter', { seconds: metrics.graduationSeconds }),
  })
}

/** The terms a builder judges a launchpad by, read from its config. */
const termsText = (launchpad: LaunchpadRecord): string => {
  const { parameters, quoteToken } = launchpad.config
  return t('components.presetCatalog.terms', {
    threshold: formatAmount(wholeQuoteTokens(parameters.migrationQuoteThreshold, quoteToken)),
    symbol: QUOTE_TOKENS[quoteToken].symbol,
    creator: parameters.creatorTradingFeePercentage,
  })
}
</script>

<style lang="scss">
@use '../../styles/mixins';

.preset-catalog {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  @include mixins.surface;
}

.preset-catalog__summary {
  cursor: pointer;
  font-size: var(--font-size-3);
  font-weight: var(--font-weight-strong);
}

.preset-catalog__hint,
.preset-catalog__text {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.preset-catalog__text--risk {
  color: var(--color-loss);
}

.preset-catalog__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--card-min-width)), 1fr));
  gap: var(--space-3);
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
}

.preset-catalog__entry {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-background);
}

.preset-catalog__name {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  font-weight: var(--font-weight-strong);
  overflow-wrap: anywhere;
}

.preset-catalog__outcome {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-2);
}

.preset-catalog__link {
  color: var(--color-gain);
  font-weight: var(--font-weight-regular);
}

.preset-catalog__button {
  align-self: flex-start;
  margin-top: auto;
  padding: var(--space-2) var(--space-3);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-surface);
  color: var(--color-surface-foreground);
  font-family: var(--font-family);
  font-size: var(--font-size-2);
  cursor: pointer;
}
</style>
