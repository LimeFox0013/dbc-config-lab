<template>
  <p
    v-if="failure"
    class="refusal-notice"
    role="alert"
  >
    {{ failure.message ?? t('components.refusalNotice.unreachable') }}
  </p>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RefusalNoticeProps } from './types'

/** `account-page`: a refusal from the service, shown in the service's own words. */
defineProps<RefusalNoticeProps>()
const { t } = useI18n()
</script>

<style lang="scss">
.refusal-notice {
  margin: 0;
  padding: var(--space-3);
  border: var(--border-width-1) solid var(--color-loss);
  border-radius: var(--radius-2);
  color: var(--color-loss);
  font-size: var(--font-size-2);
}
</style>
