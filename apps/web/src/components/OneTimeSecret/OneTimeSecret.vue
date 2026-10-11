<template>
  <section
    v-if="secret"
    class="one-time-secret"
    :aria-label="title"
  >
    <p class="one-time-secret__title">
      {{ title }}
    </p>
    <code class="one-time-secret__value">{{ secret }}</code>
    <p class="one-time-secret__notice">
      {{ t('components.oneTimeSecret.notice') }}
    </p>
    <div class="one-time-secret__actions">
      <button
        type="button"
        class="one-time-secret__button"
        @click="copy"
      >
        {{ copyState === CopyState.Copied ? t('components.oneTimeSecret.copied') : t('components.oneTimeSecret.copy') }}
      </button>
      <button
        type="button"
        class="one-time-secret__button"
        @click="emit('dismiss')"
      >
        {{ t('components.oneTimeSecret.dismiss') }}
      </button>
    </div>
    <p
      v-if="copyState === CopyState.Failed"
      class="one-time-secret__notice"
      role="alert"
    >
      {{ t('components.oneTimeSecret.copyFailed') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CopyState } from './constants'
import type { OneTimeSecretProps } from './types'

/**
 * `account-page`: a secret the service disclosed once. It is shown only while its holder
 * keeps it; dismissing it drops it for good.
 */
const props = defineProps<OneTimeSecretProps>()
const emit = defineEmits<{ dismiss: [] }>()
const { t } = useI18n()

const copyState = ref<CopyState>(CopyState.Idle)
watch(
  () => props.secret,
  () => {
    copyState.value = CopyState.Idle
  },
)

const copy = async (): Promise<void> => {
  if (!props.secret) return
  try {
    await navigator.clipboard.writeText(props.secret)
    copyState.value = CopyState.Copied
  }
  catch {
    copyState.value = CopyState.Failed
  }
}
</script>

<style lang="scss">
@use '../../styles/mixins';

.one-time-secret {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: var(--border-width-1) solid var(--color-gain);
  border-radius: var(--radius-2);
}

.one-time-secret__title {
  margin: 0;
  font-weight: var(--font-weight-strong);
}

.one-time-secret__value {
  padding: var(--space-2);
  border-radius: var(--radius-2);
  background: var(--color-background);
  color: var(--color-background-foreground);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-2);
  overflow-wrap: anywhere;
  user-select: all;
}

.one-time-secret__notice {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.one-time-secret__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.one-time-secret__button {
  @include mixins.control;
  @include mixins.clickable;
}
</style>
