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

    <div class="wallet-bar__wallets">
      <p
        v-if="connected"
        class="wallet-bar__hint"
      >
        {{ t('components.walletBar.connectedAs', { wallet: connected.wallet.name, address: connected.owner.toBase58() }) }}
      </p>
      <template v-else-if="wallets.length > 0">
        <button
          v-for="wallet in wallets"
          :key="wallet.name"
          type="button"
          class="wallet-bar__control wallet-bar__button"
          :disabled="disabled"
          @click="emit('connect', wallet)"
        >
          <img
            v-if="isSafeWalletIcon(wallet.icon)"
            :src="wallet.icon"
            alt=""
            class="wallet-bar__icon"
          />
          {{ t('components.walletBar.connect', { wallet: wallet.name }) }}
        </button>
      </template>
      <p
        v-else
        class="wallet-bar__hint"
      >
        {{ t('components.walletBar.noWallet') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SolanaNetwork } from '../../core/shared'
import { useI18n } from 'vue-i18n'
import { isSafeWalletIcon } from '../../features/deployment'
import type { DeployWallet } from '../../features/wallet'
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

.wallet-bar__label,
.wallet-bar__hint {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.wallet-bar__control {
  @include mixins.control;
}

.wallet-bar__button {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  @include mixins.clickable;
}

.wallet-bar__icon {
  width: var(--space-4);
  height: var(--space-4);
}

.wallet-bar__acknowledge {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  color: var(--color-loss);
  font-size: var(--font-size-2);
}

.wallet-bar__wallets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: center;
}
</style>
