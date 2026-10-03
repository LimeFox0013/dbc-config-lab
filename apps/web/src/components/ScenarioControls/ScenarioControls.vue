<template>
  <fieldset class="scenario-controls">
    <legend class="scenario-controls__legend">
      {{ t('components.scenarioControls.legend') }}
    </legend>
    <div class="scenario-controls__fields">
      <label class="scenario-controls__field">
        <span class="scenario-controls__label">{{ t('components.scenarioControls.preset') }}</span>
        <select
          class="scenario-controls__select"
          :value="presetId"
          @change="selectPreset($event)"
        >
          <option
            v-for="id in presetIds"
            :key="id"
            :value="id"
          >
            {{ t(`components.scenarioControls.presets.${id}.name`) }}
          </option>
          <option
            v-if="presetId === CUSTOM"
            :value="CUSTOM"
          >
            {{ t('components.scenarioControls.custom') }}
          </option>
        </select>
      </label>
      <label class="scenario-controls__field">
        <span class="scenario-controls__label">{{ t('components.scenarioControls.seed') }}</span>
        <input
          class="scenario-controls__input"
          type="number"
          min="0"
          :max="SCENARIO_LIMITS.maxSeed"
          :value="modelValue.seed"
          @change="update({ seed: readNumber($event) })"
        />
      </label>
      <label class="scenario-controls__field">
        <span class="scenario-controls__label">{{ t('components.scenarioControls.snipers') }}</span>
        <input
          class="scenario-controls__input"
          type="number"
          :min="SCENARIO_LIMITS.minTraders"
          :max="SCENARIO_LIMITS.maxTraders"
          :value="modelValue.snipers.count"
          @change="update({ snipers: { ...modelValue.snipers, count: readNumber($event) } })"
        />
      </label>
      <label class="scenario-controls__field">
        <span class="scenario-controls__label">{{ t('components.scenarioControls.humans') }}</span>
        <input
          class="scenario-controls__input"
          type="number"
          :min="SCENARIO_LIMITS.minTraders"
          :max="SCENARIO_LIMITS.maxTraders"
          :value="modelValue.humans.count"
          @change="update({ humans: { ...modelValue.humans, count: readNumber($event) } })"
        />
      </label>
      <label class="scenario-controls__field">
        <span class="scenario-controls__label">{{ t('components.scenarioControls.adaptiveSnipers') }}</span>
        <input
          class="scenario-controls__input"
          type="number"
          :min="SCENARIO_LIMITS.minTraders"
          :max="SCENARIO_LIMITS.maxTraders"
          :value="modelValue.adaptiveSnipers.count"
          @change="update({ adaptiveSnipers: { ...modelValue.adaptiveSnipers, count: readNumber($event) } })"
        />
      </label>
      <label class="scenario-controls__field">
        <span class="scenario-controls__label">{{ t('components.scenarioControls.arbitrageurs') }}</span>
        <input
          class="scenario-controls__input"
          type="number"
          :min="SCENARIO_LIMITS.minTraders"
          :max="SCENARIO_LIMITS.maxTraders"
          :value="modelValue.arbitrageurs.count"
          @change="update({ arbitrageurs: { ...modelValue.arbitrageurs, count: readNumber($event) } })"
        />
      </label>
      <label
        v-if="modelValue.arbitrageurs.count > 0"
        class="scenario-controls__field"
      >
        <span class="scenario-controls__label">{{ t('components.scenarioControls.fairMarketCap') }}</span>
        <input
          class="scenario-controls__input"
          type="number"
          :min="SCENARIO_LIMITS.minFairMarketCapSol"
          :max="SCENARIO_LIMITS.maxFairMarketCapSol"
          :value="modelValue.arbitrageurs.fairMarketCapSol"
          @change="update({ arbitrageurs: { ...modelValue.arbitrageurs, fairMarketCapSol: readNumber($event) } })"
        />
      </label>
    </div>
    <label class="scenario-controls__toggle">
      <input
        type="checkbox"
        :checked="modelValue.unlockedLiquidityPulled"
        @change="update({ unlockedLiquidityPulled: readChecked($event) })"
      />
      {{ t('components.scenarioControls.liquidityPulled') }}
    </label>
    <p
      v-if="presetId !== CUSTOM"
      class="scenario-controls__summary"
    >
      {{ t(`components.scenarioControls.presets.${presetId}.description`) }}
    </p>
    <p class="scenario-controls__summary">
      {{
        t('components.scenarioControls.summary', {
          snipers: modelValue.snipers.count,
          sniperWindow: modelValue.snipers.buyWithinSeconds,
          hold: modelValue.snipers.holdSeconds,
          humans: modelValue.humans.count,
          from: modelValue.humans.arriveFromSeconds,
          until: modelValue.humans.arriveUntilSeconds,
          adaptive: modelValue.adaptiveSnipers.count,
          maxFee: modelValue.adaptiveSnipers.maxFeeBps / 100,
        })
      }}
    </p>
    <p
      v-if="modelValue.arbitrageurs.count > 0"
      class="scenario-controls__summary"
    >
      {{
        t('components.scenarioControls.arbitrageSummary', {
          count: modelValue.arbitrageurs.count,
          marketCap: modelValue.arbitrageurs.fairMarketCapSol,
          every: modelValue.arbitrageurs.checkEverySeconds,
          until: modelValue.arbitrageurs.untilSeconds,
          gap: modelValue.arbitrageurs.gapBps / 100,
        })
      }}
    </p>
  </fieldset>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { sanitizeScenario, SCENARIO_LIMITS } from '../../features/comparison'
import { SCENARIO_PRESETS, ScenarioPresetId } from '../../core/sniper-scenario'
import type { ScenarioSpec } from '../../core/sniper-scenario'
import { CUSTOM } from './constants'
import type { ScenarioControlsProps } from './types'

const props = defineProps<ScenarioControlsProps>()
const emit = defineEmits<{ 'update:modelValue': [value: ScenarioSpec] }>()
const { t } = useI18n()

const readNumber = (event: Event): number =>
  event.target instanceof HTMLInputElement ? event.target.valueAsNumber : Number.NaN

const readChecked = (event: Event): boolean =>
  event.target instanceof HTMLInputElement && event.target.checked

const update = (patch: Partial<ScenarioSpec>): void => {
  emit('update:modelValue', sanitizeScenario({ ...props.modelValue, ...patch }))
}

const presetIds = Object.values(ScenarioPresetId)
const isPresetId = (value: string): value is ScenarioPresetId => presetIds.some((id) => id === value)

/** Compares the traders only: the seed and the liquidity option apply to any preset. */
const tradersOf = (spec: ScenarioSpec): string =>
  JSON.stringify({ ...spec, seed: 0, unlockedLiquidityPulled: false })

const presetId = computed<ScenarioPresetId | typeof CUSTOM>(
  () => presetIds.find((id) => tradersOf(SCENARIO_PRESETS[id]) === tradersOf(props.modelValue)) ?? CUSTOM,
)

const selectPreset = (event: Event): void => {
  if (!(event.target instanceof HTMLSelectElement) || !isPresetId(event.target.value)) return
  emit('update:modelValue', {
    ...SCENARIO_PRESETS[event.target.value],
    seed: props.modelValue.seed,
    unlockedLiquidityPulled: props.modelValue.unlockedLiquidityPulled,
  })
}
</script>

<style lang="scss">
.scenario-controls {
  margin: 0;
  padding: var(--space-4);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-surface);
  color: var(--color-surface-foreground);
}

.scenario-controls__legend {
  padding: 0 var(--space-2);
  font-weight: 600;
}

.scenario-controls__fields {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.scenario-controls__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.scenario-controls__label {
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.scenario-controls__select {
  padding: var(--space-2);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-background);
  color: var(--color-background-foreground);
  font-family: var(--font-family);
  font-size: var(--font-size-3);
}

.scenario-controls__input {
  width: var(--input-width-number);
  padding: var(--space-2);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-background);
  color: var(--color-background-foreground);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-3);
}

.scenario-controls__toggle {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-top: var(--space-3);
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.scenario-controls__summary {
  margin: var(--space-3) 0 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}
</style>
