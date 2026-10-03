<template>
  <section class="config-editor">
    <h2 class="config-editor__title">
      {{ t('components.configEditor.title') }}
    </h2>

    <div class="config-editor__row">
      <label class="config-editor__field">
        <span class="config-editor__label">{{ t('components.configEditor.startFrom') }}</span>
        <select
          class="config-editor__control"
          :value="startFromId"
          @change="startFrom($event)"
        >
          <option
            v-for="preset in presets"
            :key="preset.id"
            :value="preset.id"
          >
            {{ preset.name }}
          </option>
        </select>
      </label>
      <label class="config-editor__field">
        <span class="config-editor__label">{{ t('components.configEditor.name') }}</span>
        <input
          v-model.trim="name"
          class="config-editor__control"
          type="text"
          :maxlength="NAME_MAX_LENGTH"
        />
      </label>
    </div>

    <fieldset
      v-for="group in groups"
      :key="group"
      class="config-editor__group"
    >
      <legend class="config-editor__legend">
        {{ t(`components.configEditor.groups.${group}`) }}
      </legend>
      <div class="config-editor__fields">
        <label
          v-for="field in visibleFields(group)"
          :key="field.id"
          class="config-editor__field"
        >
          <span class="config-editor__label">
            {{ t(`components.configEditor.fields.${field.id}`) }}
            <span
              v-if="field.unit !== FieldUnit.None"
              class="config-editor__unit"
            >({{ unitLabel(field.unit) }})</span>
          </span>
          <select
            v-if="field.kind === FieldKind.Select"
            class="config-editor__control"
            :value="field.read(config)"
            @change="onEdit(field, $event)"
          >
            <option
              v-for="option in field.options"
              :key="option.value"
              :value="option.value"
            >
              {{ t(`components.configEditor.options.${option.labelKey}`) }}
            </option>
          </select>
          <input
            v-else
            class="config-editor__control config-editor__control--number"
            type="number"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            :value="field.read(config)"
            @change="onEdit(field, $event)"
          />
        </label>
      </div>
    </fieldset>

    <p
      class="config-editor__status"
      :class="statusClass"
      role="status"
    >
      {{ statusText }}
    </p>
    <p
      v-if="status.valid && !status.keepersMigrate"
      class="config-editor__status config-editor__status--problem"
      role="status"
    >
      {{
        t('components.configEditor.status.keepersWontMigrate', {
          minimum: QUOTE_TOKENS[config.quoteToken].keeperMinimumThreshold,
          symbol: QUOTE_TOKENS[config.quoteToken].symbol,
        })
      }}
    </p>

    <div class="config-editor__actions">
      <button
        type="button"
        class="config-editor__add"
        :disabled="!canAdd"
        @click="add"
      >
        {{ t('components.configEditor.add') }}
      </button>
      <button
        type="button"
        class="config-editor__secondary"
        :disabled="!status.valid"
        @click="copyShareLink"
      >
        {{ t('components.configEditor.copyLink') }}
      </button>
      <button
        type="button"
        class="config-editor__secondary"
        :disabled="!status.valid"
        :aria-expanded="showCode"
        @click="showCode = !showCode"
      >
        {{ showCode ? t('components.configEditor.hideCode') : t('components.configEditor.showCode') }}
      </button>
    </div>

    <p
      v-if="copyNotice"
      class="config-editor__notice"
      role="status"
    >
      {{ copyNotice }}
    </p>
    <input
      v-if="manualCopy"
      class="config-editor__control config-editor__manual"
      type="text"
      readonly
      :value="manualCopy"
      :aria-label="t('components.configEditor.manualCopy')"
      @focus="selectAll($event)"
    />

    <div
      v-if="showCode && status.valid"
      class="config-editor__code"
    >
      <pre class="config-editor__pre"><code>{{ code }}</code></pre>
      <button
        type="button"
        class="config-editor__secondary"
        @click="copyCode"
      >
        {{ t('components.configEditor.copyCode') }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DEFAULT_LAUNCH_CONFIG, parseLaunchConfig, serializeLaunchConfig } from '../../core/launch-config'
import type { LaunchConfig, LaunchPreset } from '../../core/launch-config'
import { QUOTE_TOKENS } from '../../core/quote-token'
import {
  applyEdit,
  EDITOR_FIELDS,
  editorStatus,
  FieldGroup,
  FieldKind,
  FieldUnit,
} from '../../features/config-editor'
import type { EditorField } from '../../features/config-editor'
import { CUSTOM_PRESET_ID, NAME_MAX_LENGTH } from './constants'
import { shareLink, toTypeScript } from '../../features/config-sharing'
import type { ConfigEditorProps } from './types'

const props = defineProps<ConfigEditorProps>()
const emit = defineEmits<{ add: [preset: LaunchPreset] }>()
const { t } = useI18n()

const groups = Object.values(FieldGroup)

/** A deep, independent copy, so edits can never reach the source preset. */
const copyOf = (config: LaunchConfig): LaunchConfig => parseLaunchConfig(serializeLaunchConfig(config))

const initial = props.presets.find((p) => p.id !== CUSTOM_PRESET_ID)
const startFromId = ref(initial?.id ?? '')
const config = ref<LaunchConfig>(copyOf(initial?.config ?? DEFAULT_LAUNCH_CONFIG))
const name = ref(t('components.configEditor.defaultName'))
const lastRejection = ref<string | null>(null)
const showCode = ref(false)
const copyNotice = ref<string | null>(null)
const manualCopy = ref<string | null>(null)

/** Amount units follow the config's quote token; the rest are fixed words. */
const unitLabel = (unit: FieldUnit): string =>
  unit === FieldUnit.Quote ?
    QUOTE_TOKENS[config.value.quoteToken].symbol :
      t(`components.configEditor.units.${unit}`)

const visibleFields = (group: FieldGroup): EditorField[] =>
  EDITOR_FIELDS.filter((field) => field.group === group && field.visible(config.value))

const readInput = (event: Event): number => {
  const target = event.target
  if (target instanceof HTMLInputElement) return target.valueAsNumber
  if (target instanceof HTMLSelectElement) return Number(target.value)
  return Number.NaN
}

const onEdit = (field: EditorField, event: Event): void => {
  const result = applyEdit(config.value, field, readInput(event))
  if (result.ok) {
    config.value = result.config
    lastRejection.value = null
  }
  else {
    lastRejection.value = t(`components.configEditor.rejections.${result.reason}`)
  }
}

const startFrom = (event: Event): void => {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) return
  const preset = props.presets.find((p) => p.id === target.value)
  if (!preset) return
  startFromId.value = preset.id
  config.value = copyOf(preset.config)
  lastRejection.value = null
}

const status = computed(() => editorStatus(config.value))
const canAdd = computed(() => status.value.valid && status.value.simulatable && name.value.length > 0)

const statusText = computed(() => {
  if (lastRejection.value) return lastRejection.value
  const s = status.value
  if (!s.valid) return t('components.configEditor.status.invalid', { reason: s.reason })
  if (!s.simulatable) return t('components.configEditor.status.notSimulatable', { reason: s.reason })
  return t('components.configEditor.status.valid')
})

const statusClass = computed(() =>
  lastRejection.value || !status.value.valid || !status.value.simulatable ?
    'config-editor__status--problem' :
    'config-editor__status--ok',
)

const code = computed(() => toTypeScript(config.value))

/** Copies to the clipboard, or shows the text in a selectable field where that is not allowed. */
const copy = async (value: string, copiedKey: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(value)
    manualCopy.value = null
    copyNotice.value = t(copiedKey)
  }
  catch {
    manualCopy.value = value
    copyNotice.value = t('components.configEditor.copyFailed')
  }
}

const copyShareLink = (): Promise<void> =>
  copy(shareLink({ config: config.value, name: name.value }, window.location.href), 'components.configEditor.linkCopied')

const copyCode = (): Promise<void> => copy(code.value, 'components.configEditor.codeCopied')

const selectAll = (event: Event): void => {
  if (event.target instanceof HTMLInputElement) event.target.select()
}

const add = (): void => {
  if (!canAdd.value) return
  emit('add', {
    id: CUSTOM_PRESET_ID,
    name: name.value,
    intent: t('components.configEditor.intent'),
    config: copyOf(config.value),
  })
}
</script>

<style lang="scss">
.config-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-surface);
  color: var(--color-surface-foreground);
}

.config-editor__title {
  margin: 0;
  font-size: var(--font-size-3);
}

.config-editor__row,
.config-editor__fields {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.config-editor__group {
  margin: 0;
  padding: var(--space-3);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
}

.config-editor__legend {
  padding: 0 var(--space-2);
  font-size: var(--font-size-2);
  font-weight: 600;
}

.config-editor__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.config-editor__label {
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.config-editor__unit {
  font-size: var(--font-size-1);
}

.config-editor__control {
  padding: var(--space-2);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-background);
  color: var(--color-background-foreground);
  font-family: var(--font-family);
  font-size: var(--font-size-2);
}

.config-editor__control--number {
  width: var(--input-width-number);
  font-family: var(--font-family-mono);
}

.config-editor__status {
  margin: 0;
  font-size: var(--font-size-2);
  overflow-wrap: anywhere;
}

.config-editor__status--ok {
  color: var(--color-gain);
}

.config-editor__status--problem {
  color: var(--color-loss);
}

.config-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.config-editor__secondary {
  padding: var(--space-2) var(--space-3);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-background);
  color: var(--color-background-foreground);
  font-family: var(--font-family);
  font-size: var(--font-size-2);
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    color: var(--color-muted-foreground);
  }
}

.config-editor__notice {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.config-editor__manual {
  width: 100%;
  font-family: var(--font-family-mono);
}

.config-editor__code {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.config-editor__pre {
  max-height: var(--code-max-height);
  margin: 0;
  padding: var(--space-3);
  overflow: auto;
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-background);
  color: var(--color-background-foreground);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-1);
}

.config-editor__add {
  align-self: flex-start;
  padding: var(--space-2) var(--space-3);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-background);
  color: var(--color-background-foreground);
  font-family: var(--font-family);
  font-size: var(--font-size-2);
  cursor: pointer;

  &:enabled {
    border-color: var(--color-gain);
  }

  &:disabled {
    cursor: not-allowed;
    color: var(--color-muted-foreground);
  }
}
</style>
