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
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { connectionFor, SolanaNetwork } from '../../core/config-deploy'
import { loadOnChainConfig, MAX_ADDRESS_LENGTH } from '../../features/onchain-config'
import type { OnChainConfig } from '../../features/onchain-config'

const emit = defineEmits<{ load: [loaded: OnChainConfig] }>()
const { t } = useI18n()

const network = ref<SolanaNetwork>(SolanaNetwork.Devnet)
const address = ref('')
const loading = ref(false)
const status = ref<string | null>(null)
const failed = ref(false)

const load = async (): Promise<void> => {
  loading.value = true
  status.value = null
  const result = await loadOnChainConfig(connectionFor(network.value), network.value, address.value)
  loading.value = false
  failed.value = !result.ok
  if (!result.ok) {
    status.value = t(`components.onChainLoader.rejections.${result.rejection}`, { detail: result.detail ?? '' })
    return
  }
  status.value = t('components.onChainLoader.loaded')
  emit('load', result.loaded)
}
</script>

<style lang="scss">
.on-chain-loader {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-surface);
  color: var(--color-surface-foreground);
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
  min-width: var(--text-max-width-narrow);
}

.on-chain-loader__control,
.on-chain-loader__load {
  padding: var(--space-2) var(--space-3);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-background);
  color: var(--color-background-foreground);
  font-family: var(--font-family);
  font-size: var(--font-size-2);
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
