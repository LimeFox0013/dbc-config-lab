<template>
  <details
    class="income-forecast"
    @toggle="onToggle"
  >
    <summary class="income-forecast__summary">
      {{ t('components.incomeForecast.title') }}
    </summary>
    <p class="income-forecast__hint">
      {{ t('components.incomeForecast.intro') }}
    </p>
    <p
      v-if="open && !records"
      class="income-forecast__hint"
    >
      {{ t('components.incomeForecast.loading') }}
    </p>
    <template v-else-if="records">
      <div class="income-forecast__controls">
        <label class="income-forecast__field">
          <span class="income-forecast__label">{{ t('components.incomeForecast.config') }}</span>
          <select
            v-model="selectedId"
            class="income-forecast__control"
          >
            <option
              v-for="option in forecastable"
              :key="option.id"
              :value="option.id"
            >
              {{ option.name }}
            </option>
          </select>
        </label>
        <label class="income-forecast__field">
          <span class="income-forecast__label">{{ t('components.incomeForecast.launches') }}</span>
          <input
            v-model.number="launches"
            class="income-forecast__control"
            type="number"
            min="1"
            :max="MAX_LAUNCHES"
            step="1"
          />
        </label>
      </div>
      <template v-if="archetype && forecast">
        <p class="income-forecast__hint">
          {{ t('components.incomeForecast.terms', archetypeText) }}
        </p>
        <p
          v-if="forecast.ok"
          class="income-forecast__result"
        >
          {{ t('components.incomeForecast.range', { low: formatSol(forecast.low), high: formatSol(forecast.high), launches: formatCount(launchCount) }) }}
        </p>
        <p
          v-if="forecast.ok"
          class="income-forecast__hint"
        >
          {{ t('components.incomeForecast.basis', { launchpads: forecast.launchpads, launches: formatCount(forecast.launches), date: forecast.takenAt }) }}
        </p>
        <p
          v-else
          class="income-forecast__hint"
        >
          {{ t('components.incomeForecast.tooFew', { found: forecast.comparables, minimum: forecast.minimum }) }}
        </p>
      </template>
      <p class="income-forecast__hint">
        {{ t('components.incomeForecast.caveat') }}
      </p>
    </template>
  </details>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { clamp, formatCount, formatSol } from '../../core/shared'
import { archetypeOf, incomeForecast, useLaunchpadSnapshot } from '../../features/launchpad-economics'
import { DEFAULT_LAUNCHES, MAX_LAUNCHES } from './constants'
import type { IncomeForecastProps } from './types'

const props = defineProps<IncomeForecastProps>()
const { t } = useI18n()

const { open, records, onToggle } = useLaunchpadSnapshot()

const forecastable = computed(() => props.entries.filter((entry) => entry.compiled.ok))
const entryId = ref('')
/** The chosen config, or the first one until a choice is made or when the choice leaves the comparison. */
const entry = computed(() =>
  forecastable.value.find((candidate) => candidate.id === entryId.value) ?? forecastable.value[0] ?? null,
)
const selectedId = computed({
  get: () => entry.value?.id ?? '',
  set: (id: string) => {
    entryId.value = id
  },
})
const launches = ref(DEFAULT_LAUNCHES)
const launchCount = computed(() => clamp(Math.round(launches.value) || 0, 0, MAX_LAUNCHES))

const archetype = computed(() => {
  const compiled = entry.value?.compiled
  return compiled?.ok ? archetypeOf(compiled.parameters, compiled.quoteToken) : null
})
const forecast = computed(() =>
  records.value && archetype.value ? incomeForecast(records.value, archetype.value, launchCount.value) : null,
)
const archetypeText = computed(() => {
  const a = archetype.value
  if (!a) return {}
  return {
    quote: t(`common.launchpadTerms.quoteToken.${a.quoteToken}`),
    threshold: t(`common.launchpadTerms.thresholdBand.${a.thresholdBand}`),
    fee: t(`common.launchpadTerms.feeShape.${a.feeShape}`),
    creator: t(`common.launchpadTerms.creatorShare.${a.creatorShare}`),
  }
})

</script>

<style lang="scss">
@use '../../styles/mixins';

.income-forecast {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  @include mixins.surface;
}

.income-forecast__summary {
  cursor: pointer;
  font-size: var(--font-size-3);
  font-weight: var(--font-weight-strong);
}

.income-forecast__hint {
  margin: var(--space-2) 0 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.income-forecast__result {
  margin: var(--space-3) 0 0;
  font-family: var(--font-family-mono);
  font-size: var(--font-size-3);
}

.income-forecast__controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.income-forecast__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.income-forecast__label {
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.income-forecast__control {
  @include mixins.control;
}
</style>
