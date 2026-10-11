<template>
  <div class="wallet-bar">
    <label class="wallet-bar__field">
      <span class="wallet-bar__label">{{ t('components.walletBar.network') }}</span>
      <select
        v-model="network"
        class="wallet-bar__control"
        :disabled="disabled || networkLocked"
      >
        <option :value="SolanaNetwork.Devnet">
          {{ t('components.walletBar.devnet') }}
        </option>
        <option :value="SolanaNetwork.Mainnet">
          {{ t('components.walletBar.mainnet') }}
        </option>
      </select>
    </label>

    <label
      v-if="network === SolanaNetwork.Mainnet"
      class="wallet-bar__acknowledge"
    >
      <input
        v-model="acknowledged"
        type="checkbox"
      />
      {{ t(`components.walletBar.mainnetAcknowledge.${acknowledgement}`) }}
    </label>

    <WalletPicker
      :wallets="wallets"
      :connected="connected"
      :disabled="disabled"
      :no-wallet-text="t('components.walletBar.noWallet')"
      @connect="emit('connect', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { SolanaNetwork } from '@dbc-config-lab/core/core/shared'
import { useI18n } from 'vue-i18n'
import type { DeployWallet } from '@dbc-config-lab/core/features/wallet'
import { WalletPicker } from '../WalletPicker'
import type { WalletBarProps } from './types'

withDefaults(defineProps<WalletBarProps>(), { networkLocked: false })
const network = defineModel<SolanaNetwork>('network', { required: true })
const acknowledged = defineModel<boolean>('acknowledged', { required: true })
const emit = defineEmits<{ connect: [wallet: DeployWallet] }>()
const { t } = useI18n()
</script>

<style lang="scss">
@use '../../styles/mixins';

.wallet-bar {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.wallet-bar__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  align-self: flex-start;
}

.wallet-bar__label {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.wallet-bar__control {
  @include mixins.control;
}

.wallet-bar__acknowledge {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  color: var(--color-loss);
  font-size: var(--font-size-2);
}
</style>
