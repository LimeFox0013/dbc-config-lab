<template>
  <section class="deploy-panel">
    <h2 class="deploy-panel__title">
      {{ t('components.deployPanel.title') }}
    </h2>

    <div class="deploy-panel__row">
      <label class="deploy-panel__field">
        <span class="deploy-panel__label">{{ t('components.deployPanel.preset') }}</span>
        <select
          v-model="presetId"
          class="deploy-panel__select"
        >
          <option
            v-for="option in presets"
            :key="option.id"
            :value="option.id"
          >
            {{ option.name }}
          </option>
        </select>
      </label>
      <label class="deploy-panel__field">
        <span class="deploy-panel__label">{{ t('components.deployPanel.network') }}</span>
        <select
          v-model="network"
          class="deploy-panel__select"
        >
          <option :value="SolanaNetwork.Devnet">
            {{ t('components.deployPanel.devnet') }}
          </option>
          <option :value="SolanaNetwork.Mainnet">
            {{ t('components.deployPanel.mainnet') }}
          </option>
        </select>
      </label>
    </div>

    <label
      v-if="network === SolanaNetwork.Mainnet"
      class="deploy-panel__acknowledge"
    >
      <input
        v-model="mainnetAcknowledged"
        type="checkbox"
      />
      {{ t('components.deployPanel.mainnetAcknowledge') }}
    </label>

    <div class="deploy-panel__wallets">
      <p
        v-if="connected"
        class="deploy-panel__connected"
      >
        {{ t('components.deployPanel.connectedAs', { wallet: connected.wallet.name, address: connected.owner.toBase58() }) }}
      </p>
      <template v-else-if="wallets.length > 0">
        <button
          v-for="wallet in wallets"
          :key="wallet.name"
          type="button"
          class="deploy-panel__button"
          @click="connect(wallet)"
        >
          <img
            v-if="isSafeWalletIcon(wallet.icon)"
            :src="wallet.icon"
            alt=""
            class="deploy-panel__wallet-icon"
          />
          {{ t('components.deployPanel.connect', { wallet: wallet.name }) }}
        </button>
      </template>
      <p
        v-else
        class="deploy-panel__hint"
      >
        {{ t('components.deployPanel.noWallet') }}
      </p>
    </div>

    <button
      v-if="step !== DeployStep.Ready && step !== DeployStep.Signing && step !== DeployStep.Done"
      type="button"
      class="deploy-panel__button deploy-panel__button--primary"
      :disabled="!prepareAllowed || step === DeployStep.Preparing"
      @click="prepare"
    >
      {{ step === DeployStep.Preparing ? t('components.deployPanel.preparing') : t('components.deployPanel.prepare') }}
    </button>

    <dl
      v-if="prepared && step !== DeployStep.Done"
      class="deploy-panel__summary"
    >
      <dt>{{ t('components.deployPanel.summary.network') }}</dt>
      <dd class="deploy-panel__value deploy-panel__value--network">
        {{ prepared.summary.network }}
      </dd>
      <dt>{{ t('components.deployPanel.summary.configAddress') }}</dt>
      <dd class="deploy-panel__value">
        {{ prepared.summary.configAddress }}
      </dd>
      <dt>{{ t('components.deployPanel.summary.payer') }}</dt>
      <dd class="deploy-panel__value">
        {{ prepared.summary.payer }}
      </dd>
      <dt>{{ t('components.deployPanel.summary.feeClaimer') }}</dt>
      <dd class="deploy-panel__value">
        {{ prepared.summary.feeClaimer }}
      </dd>
      <dt>{{ t('components.deployPanel.summary.leftoverReceiver') }}</dt>
      <dd class="deploy-panel__value">
        {{ prepared.summary.leftoverReceiver }}
      </dd>
      <dt>{{ t('components.deployPanel.summary.quoteMint') }}</dt>
      <dd class="deploy-panel__value">
        {{ prepared.summary.quoteMint }}
      </dd>
      <dt>{{ t('components.deployPanel.summary.fee') }}</dt>
      <dd class="deploy-panel__value">
        {{
          t('components.deployPanel.summary.feeValue', {
            start: prepared.summary.startingFeeBps / 100,
            end: prepared.summary.endingFeeBps / 100,
            seconds: prepared.summary.feeWindowSeconds,
          })
        }}
      </dd>
      <dt>{{ t('components.deployPanel.summary.threshold') }}</dt>
      <dd class="deploy-panel__value">
        {{ t('components.deployPanel.summary.thresholdValue', { sol: prepared.summary.migrationThresholdSol }) }}
      </dd>
    </dl>

    <button
      v-if="step === DeployStep.Ready || step === DeployStep.Signing"
      type="button"
      class="deploy-panel__button deploy-panel__button--primary"
      :disabled="step === DeployStep.Signing"
      @click="signAndSend"
    >
      {{ step === DeployStep.Signing ? t('components.deployPanel.signing') : t('components.deployPanel.sign') }}
    </button>

    <p
      v-if="step === DeployStep.Done && signature && prepared"
      class="deploy-panel__done"
    >
      {{ t('components.deployPanel.done') }}
      <a
        :href="explorerAddressUrl(prepared.summary.configAddress, network)"
        target="_blank"
        rel="noopener noreferrer"
        class="deploy-panel__link"
      >{{ t('components.deployPanel.viewConfig') }}</a>
      <a
        :href="explorerTransactionUrl(signature, network)"
        target="_blank"
        rel="noopener noreferrer"
        class="deploy-panel__link"
      >{{ t('components.deployPanel.viewTransaction') }}</a>
    </p>

    <p
      v-if="error"
      class="deploy-panel__error"
      role="alert"
    >
      {{ error }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { explorerAddressUrl, explorerTransactionUrl, SolanaNetwork } from '../../core/config-deploy'
import type { LaunchPreset } from '../../core/launch-config'
import { DeployStep, isSafeWalletIcon, useDeployment } from '../../features/deployment'
import type { DeployPanelProps } from './types'

const props = defineProps<DeployPanelProps>()
const { t } = useI18n()

const presetId = ref<LaunchPreset['id']>(props.presets.find(Boolean)?.id ?? '')
const preset = computed<LaunchPreset>(() => {
  const found = props.presets.find((candidate) => candidate.id === presetId.value)
  if (!found) throw new Error(`Unknown preset ${presetId.value}`)
  return found
})

const {
  network,
  mainnetAcknowledged,
  wallets,
  connected,
  prepared,
  step,
  error,
  signature,
  prepareAllowed,
  connect,
  prepare,
  signAndSend,
} = useDeployment(preset)
</script>

<style lang="scss">
.deploy-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-surface);
  color: var(--color-surface-foreground);
}

.deploy-panel__title {
  margin: 0;
  font-size: var(--font-size-3);
}

.deploy-panel__row,
.deploy-panel__wallets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: center;
}

.deploy-panel__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.deploy-panel__label,
.deploy-panel__hint,
.deploy-panel__connected {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.deploy-panel__select,
.deploy-panel__button {
  padding: var(--space-2) var(--space-3);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-background);
  color: var(--color-background-foreground);
  font-family: var(--font-family);
  font-size: var(--font-size-2);
}

.deploy-panel__button {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  align-self: flex-start;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    color: var(--color-muted-foreground);
  }
}

.deploy-panel__button--primary:enabled {
  border-color: var(--color-gain);
}

.deploy-panel__wallet-icon {
  width: var(--space-4);
  height: var(--space-4);
}

.deploy-panel__acknowledge {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  color: var(--color-loss);
  font-size: var(--font-size-2);
}

.deploy-panel__summary {
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
  }
}

.deploy-panel__value {
  font-family: var(--font-family-mono);
  overflow-wrap: anywhere;
}

.deploy-panel__value--network {
  color: var(--color-loss);
  font-weight: 600;
}

.deploy-panel__done {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin: 0;
}

.deploy-panel__link {
  color: var(--color-gain);
}

.deploy-panel__error {
  margin: 0;
  color: var(--color-loss);
  font-size: var(--font-size-2);
  overflow-wrap: anywhere;
}
</style>
