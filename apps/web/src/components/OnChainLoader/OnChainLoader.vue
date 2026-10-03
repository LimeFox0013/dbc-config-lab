<template>
  <section class="on-chain-loader">
    <h2 class="on-chain-loader__title">
      {{ t('components.onChainLoader.title') }}
    </h2>
    <p class="on-chain-loader__hint">
      {{ t('components.onChainLoader.hint') }}
    </p>
    <form
      class="on-chain-loader__row"
      @submit.prevent="load"
    >
      <label class="on-chain-loader__field">
        <span class="on-chain-loader__label">{{ t('components.onChainLoader.network') }}</span>
        <select
          v-model="network"
          class="on-chain-loader__control"
        >
          <option :value="SolanaNetwork.Devnet">
            {{ t('components.onChainLoader.devnet') }}
          </option>
          <option :value="SolanaNetwork.Mainnet">
            {{ t('components.onChainLoader.mainnet') }}
          </option>
        </select>
      </label>
      <label class="on-chain-loader__field on-chain-loader__field--wide">
        <span class="on-chain-loader__label">{{ t('components.onChainLoader.address') }}</span>
        <input
          v-model.trim="address"
          class="on-chain-loader__control on-chain-loader__address"
          type="text"
          spellcheck="false"
          autocomplete="off"
          :maxlength="MAX_ADDRESS_LENGTH"
        />
      </label>
      <button
        type="submit"
        class="on-chain-loader__load"
        :disabled="loading || address.length === 0"
      >
        {{ loading ? t('components.onChainLoader.loading') : t('components.onChainLoader.load') }}
      </button>
    </form>
    <p
      v-if="status"
      class="on-chain-loader__status"
      :class="{ 'on-chain-loader__status--problem': failed }"
      role="status"
    >
      {{ status }}
    </p>
    <div
      v-if="real"
      class="on-chain-loader__real"
      aria-live="polite"
    >
      <h3 class="on-chain-loader__real-title">
        {{ t('components.onChainLoader.real.title') }}
      </h3>
      <p
        v-if="real.loading"
        class="on-chain-loader__hint"
      >
        {{ t('components.onChainLoader.real.loading') }}
      </p>
      <p
        v-else-if="!real.result.ok"
        class="on-chain-loader__hint"
      >
        {{ t(`components.onChainLoader.real.rejections.${real.result.rejection}`, { detail: real.result.detail ?? '' }) }}
      </p>
      <template v-else>
        <p class="on-chain-loader__hint">
          {{
            real.result.launches.sampledPools < real.result.launches.totalPools ?
              t('components.onChainLoader.real.sampled', { sampled: real.result.launches.sampledPools, total: real.result.launches.totalPools }) :
              t('components.onChainLoader.real.all', { total: real.result.launches.totalPools })
          }}
        </p>
        <dl class="on-chain-loader__figures">
          <dt>{{ t('components.onChainLoader.real.completed') }}</dt>
          <dd>{{ formatShare(real.result.launches.completedShare) }}</dd>
          <dt>{{ t('components.onChainLoader.real.traction') }}</dt>
          <dd>{{ formatShare(real.result.launches.tractionShare) }}</dd>
          <dt>{{ t('components.onChainLoader.real.neverTraded') }}</dt>
          <dd>{{ formatShare(real.result.launches.neverTradedShare) }}</dd>
          <dt>{{ t('components.onChainLoader.real.raised') }}</dt>
          <dd>{{ t('components.onChainLoader.real.solValue', { sol: formatSol(real.result.launches.medianRaised) }) }}</dd>
          <dt>{{ t('components.onChainLoader.real.fees') }}</dt>
          <dd>{{ t('components.onChainLoader.real.solValue', { sol: formatSol(real.result.launches.meanCurveFees) }) }}</dd>
          <dt>{{ t('components.onChainLoader.real.time') }}</dt>
          <dd>
            {{
              real.result.launches.medianSecondsToComplete === null ?
                t('components.onChainLoader.real.timeUnknown') :
                t('components.onChainLoader.real.seconds', { seconds: Math.round(real.result.launches.medianSecondsToComplete) })
            }}
          </dd>
        </dl>
        <p class="on-chain-loader__hint">
          {{ t('components.onChainLoader.real.compare') }}
        </p>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { RealLaunchesState } from './types'
import { formatShare, formatSol, SolanaNetwork } from '../../core/shared'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { connectionFor } from '../../core/config-deploy'
import { loadOnChainConfig, MAX_ADDRESS_LENGTH } from '../../features/onchain-config'
import type { OnChainConfig } from '../../features/onchain-config'
import { fetchRealLaunches } from '../../features/real-launches'

const emit = defineEmits<{ load: [loaded: OnChainConfig] }>()
const { t } = useI18n()

const network = ref<SolanaNetwork>(SolanaNetwork.Devnet)
const address = ref('')
const loading = ref(false)
const status = ref<string | null>(null)
const failed = ref(false)
/** How the real launches on the last loaded config went; read after the config loads. */
const real = ref<RealLaunchesState | null>(null)
/** Bumped on every load, so a slower read for an earlier config never shows. */
let lookup = 0

const load = async (): Promise<void> => {
  const current = ++lookup
  loading.value = true
  status.value = null
  real.value = null
  const result = await loadOnChainConfig(connectionFor(network.value), network.value, address.value)
  loading.value = false
  failed.value = !result.ok
  if (!result.ok) {
    status.value = t(`common.loadRejections.${result.rejection}`, { detail: result.detail ?? '' })
    return
  }
  status.value = t('components.onChainLoader.loaded')
  emit('load', result.loaded)
  real.value = { loading: true }
  const { configAddress, parameters, quoteToken } = result.loaded
  const launches = await fetchRealLaunches(connectionFor(result.loaded.network), configAddress, parameters, quoteToken)
  if (current === lookup) real.value = { loading: false, result: launches }
}
</script>

<style lang="scss">
@use '../../styles/mixins';

.on-chain-loader__real {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.on-chain-loader__real-title {
  margin: 0;
  font-size: var(--font-size-2);
}

.on-chain-loader__figures {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--space-1) var(--space-4);
  margin: 0;
  font-size: var(--font-size-2);

  dt {
    color: var(--color-muted-foreground);
  }

  dd {
    margin: 0;
    font-family: var(--font-family-mono);
  }
}

.on-chain-loader {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  @include mixins.surface;
}

.on-chain-loader__title {
  margin: 0;
  font-size: var(--font-size-3);
}

.on-chain-loader__hint,
.on-chain-loader__label,
.on-chain-loader__status {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.on-chain-loader__status--problem {
  color: var(--color-loss);
}

.on-chain-loader__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: flex-end;
}

.on-chain-loader__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.on-chain-loader__field--wide {
  flex: 1;
  min-width: min(var(--text-max-width-narrow), 100%);
}

.on-chain-loader__control,
.on-chain-loader__load {
  @include mixins.control;
}

.on-chain-loader__address {
  font-family: var(--font-family-mono);
}

.on-chain-loader__load {
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
