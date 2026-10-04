<template>
  <div
    class="real-launches"
    aria-live="polite"
  >
    <h3 class="real-launches__title">
      {{ t('components.realLaunchesSummary.title') }}
    </h3>
    <p
      v-if="state.loading"
      class="real-launches__hint"
    >
      {{ t('components.realLaunchesSummary.loading') }}
    </p>
    <p
      v-else-if="!state.result.ok"
      class="real-launches__hint"
    >
      {{ t(`components.realLaunchesSummary.rejections.${state.result.rejection}`, { detail: state.result.detail ?? '' }) }}
    </p>
    <template v-else>
      <p class="real-launches__hint">
        {{
          state.result.launches.sampledPools < state.result.launches.totalPools ?
            t('components.realLaunchesSummary.sampled', { sampled: state.result.launches.sampledPools, total: state.result.launches.totalPools }) :
            t('components.realLaunchesSummary.all', { total: state.result.launches.totalPools })
        }}
      </p>
      <dl class="real-launches__figures">
        <dt>{{ t('components.realLaunchesSummary.completed') }}</dt>
        <dd>{{ formatShare(state.result.launches.completedShare) }}</dd>
        <dt>{{ t('components.realLaunchesSummary.traction') }}</dt>
        <dd>{{ formatShare(state.result.launches.tractionShare) }}</dd>
        <dt>{{ t('components.realLaunchesSummary.neverTraded') }}</dt>
        <dd>{{ formatShare(state.result.launches.neverTradedShare) }}</dd>
        <dt>{{ t('components.realLaunchesSummary.raised') }}</dt>
        <dd>{{ t('components.realLaunchesSummary.solValue', { sol: formatSol(state.result.launches.medianRaised) }) }}</dd>
        <dt>{{ t('components.realLaunchesSummary.fees') }}</dt>
        <dd>{{ t('components.realLaunchesSummary.solValue', { sol: formatSol(state.result.launches.meanCurveFees) }) }}</dd>
        <dt>{{ t('components.realLaunchesSummary.time') }}</dt>
        <dd>
          {{
            state.result.launches.medianSecondsToComplete === null ?
              t('components.realLaunchesSummary.timeUnknown') :
              t('components.realLaunchesSummary.seconds', { seconds: Math.round(state.result.launches.medianSecondsToComplete) })
          }}
        </dd>
      </dl>
      <slot />
    </template>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatShare, formatSol } from '../../core/shared'
import type { RealLaunchesSummaryProps } from './types'

defineProps<RealLaunchesSummaryProps>()
const { t } = useI18n()
</script>

<style lang="scss">
@use '../../styles/mixins';

.real-launches {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.real-launches__title {
  margin: 0;
  font-size: var(--font-size-2);
}

.real-launches__hint {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.real-launches__figures {
  @include mixins.term-list;

  dd {
    font-family: var(--font-family-mono);
  }
}
</style>
