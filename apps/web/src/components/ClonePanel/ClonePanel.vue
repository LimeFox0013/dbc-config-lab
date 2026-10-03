<template>
  <section class="clone-panel">
    <h2 class="clone-panel__title">
      {{ t('components.clonePanel.title') }}
    </h2>
    <p class="clone-panel__hint">
      {{ t('components.clonePanel.intro') }}
    </p>
    <p
      v-if="originals.length === 0"
      class="clone-panel__hint"
    >
      {{ t('components.clonePanel.empty') }}
    </p>
    <template v-else>
      <label class="clone-panel__field">
        <span class="clone-panel__label">{{ t('components.clonePanel.original') }}</span>
        <select
          v-model="originalKey"
          class="clone-panel__control"
        >
          <option
            v-for="original in originals"
            :key="keyOf(original)"
            :value="keyOf(original)"
          >
            {{ t('components.clonePanel.originalName', { address: shortAddress(original.configAddress), network: original.network }) }}
          </option>
        </select>
      </label>

      <p
        v-if="refusal"
        class="clone-panel__error"
        role="alert"
      >
        {{ t('components.clonePanel.refused', { reason: refusal }) }}
      </p>
      <template v-else-if="form && selected">
        <fieldset
          v-if="hasSchedule"
          class="clone-panel__group"
        >
          <legend class="clone-panel__label">
            {{ t('components.clonePanel.fee') }}
          </legend>
          <label class="clone-panel__field">
            <span class="clone-panel__label">{{ t('components.clonePanel.startingFee') }}</span>
            <input
              v-model.number="form.startingFeePercent"
              class="clone-panel__control"
              type="number"
              min="0"
              step="0.01"
            />
          </label>
          <label class="clone-panel__field">
            <span class="clone-panel__label">{{ t('components.clonePanel.endingFee') }}</span>
            <input
              v-model.number="form.endingFeePercent"
              class="clone-panel__control"
              type="number"
              min="0"
              step="0.01"
            />
          </label>
          <label class="clone-panel__field">
            <span class="clone-panel__label">{{ t('components.clonePanel.window') }}</span>
            <input
              v-model.number="form.windowSeconds"
              class="clone-panel__control"
              type="number"
              min="0"
              step="1"
            />
          </label>
        </fieldset>
        <fieldset class="clone-panel__group">
          <legend class="clone-panel__label">
            {{ t('components.clonePanel.split') }}
          </legend>
          <label class="clone-panel__field">
            <span class="clone-panel__label">{{ t('components.clonePanel.creatorShare') }}</span>
            <input
              v-model.number="form.creatorTradingFeePercentage"
              class="clone-panel__control"
              type="number"
              min="0"
              max="100"
              step="1"
            />
          </label>
          <label
            v-for="key in LIQUIDITY_SHARES"
            :key="key"
            class="clone-panel__field"
          >
            <span class="clone-panel__label">{{ t(`components.clonePanel.liquidity.${key}`) }}</span>
            <input
              v-model.number="form.liquidity[key]"
              class="clone-panel__control"
              type="number"
              min="0"
              max="100"
              step="1"
            />
          </label>
        </fieldset>
        <p
          v-if="vesting.partner + vesting.creator > 0"
          class="clone-panel__hint"
        >
          {{ t('components.clonePanel.vesting', { partner: vesting.partner, creator: vesting.creator, remaining: PERCENT - vesting.partner - vesting.creator }) }}
        </p>
        <label class="clone-panel__check">
          <input
            v-model="form.firstBuyAtMinimumFee"
            type="checkbox"
          />
          {{ t('components.clonePanel.firstBuy') }}
        </label>

        <p
          v-if="!clone.ok"
          class="clone-panel__error"
          role="alert"
        >
          {{ changed ? clone.reason : t('components.clonePanel.rejectedAsIs', { reason: clone.reason }) }}
        </p>
        <p
          v-else
          class="clone-panel__hint"
        >
          {{ changed ? t('components.clonePanel.adjusted') : t('components.clonePanel.exact') }}
        </p>
        <button
          type="button"
          class="clone-panel__button"
          :disabled="!clone.ok"
          @click="add"
        >
          {{ t('components.clonePanel.add') }}
        </button>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { EntryIdPrefix, parametersEntry } from '../../features/comparison'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { clonedParameters, cloneRefusal, LIQUIDITY_SHARES } from '../../core/config-clone'
import { feeScheduleOf } from '../../core/launch-simulator'
import { PERCENT, shortAddress } from '../../core/shared'
import type { ComparisonEntry } from '../../features/comparison'
import type { OnChainConfig } from '../../features/onchain-config'
import type { ClonePanelProps, CloneForm } from './types'
import { adjustmentsOf, formOf } from './utils'

const props = defineProps<ClonePanelProps>()
const emit = defineEmits<{ add: [entry: ComparisonEntry] }>()
const { t } = useI18n()

const keyOf = (config: OnChainConfig): string => `${config.network}:${config.configAddress}`
const originalKey = ref('')
const selected = computed(() => props.originals.find((o) => keyOf(o) === originalKey.value) ?? null)
// A newly added config becomes the one to clone.
watch(
  () => props.originals[0],
  (newest) => {
    if (newest) originalKey.value = keyOf(newest)
  },
  { immediate: true },
)

const form = ref<CloneForm | null>(null)
watch(selected, (original) => {
  form.value = original ? formOf(original.parameters) : null
}, { immediate: true })

/** Vesting shares of graduation liquidity: kept by a clone, and part of the 100% the LP shares make up. */
const vesting = computed(() => ({
  partner: selected.value?.parameters.partnerLiquidityVestingInfo.vestingPercentage ?? 0,
  creator: selected.value?.parameters.creatorLiquidityVestingInfo.vestingPercentage ?? 0,
}))

const refusal = computed(() => (selected.value ? cloneRefusal(selected.value.parameters) : null))
const hasSchedule = computed(() => selected.value !== null && feeScheduleOf(selected.value.parameters) !== null)
const adjustments = computed(() =>
  selected.value && form.value ? adjustmentsOf(selected.value.parameters, form.value) : {},
)
const changed = computed(() => Object.keys(adjustments.value).length > 0)
const clone = computed(() =>
  selected.value ?
      clonedParameters(selected.value.parameters, adjustments.value) :
      { ok: false as const, reason: '' },
)

const add = (): void => {
  const original = selected.value
  if (!original || !clone.value.ok) return
  const address = shortAddress(original.configAddress)
  emit(
    'add',
    parametersEntry(
      {
        id: `${EntryIdPrefix.Clone}:${keyOf(original)}`,
        name: t('components.clonePanel.name', { address }),
        intent: t(changed.value ? 'components.clonePanel.intentAdjusted' : 'components.clonePanel.intentExact', { address }),
      },
      clone.value.parameters,
      original.quoteToken,
    ),
  )
}
</script>

<style lang="scss">
@use '../../styles/mixins';

.clone-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  @include mixins.surface;
}

.clone-panel__title {
  margin: 0;
  font-size: var(--font-size-3);
}

.clone-panel__hint {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.clone-panel__error {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-loss);
}

.clone-panel__group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin: 0;
  padding: var(--space-3);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
}

.clone-panel__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.clone-panel__label {
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.clone-panel__check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-2);
}

.clone-panel__control,
.clone-panel__button {
  @include mixins.control;
}

.clone-panel__button {
  align-self: flex-start;
  @include mixins.clickable;
}
</style>
