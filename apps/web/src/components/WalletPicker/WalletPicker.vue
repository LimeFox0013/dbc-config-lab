<template>
  <div class="wallet-picker">
    <p
      v-if="connected"
      class="wallet-picker__hint"
    >
      {{ t('components.walletPicker.connectedAs', { wallet: connected.wallet.name, address: connected.owner.toBase58() }) }}
    </p>
    <template v-else-if="wallets.length > 0">
      <button
        v-for="wallet in wallets"
        :key="wallet.name"
        type="button"
        class="wallet-picker__button"
        :disabled="disabled"
        @click="emit('connect', wallet)"
      >
        <img
          v-if="isSafeWalletIcon(wallet.icon)"
          :src="wallet.icon"
          alt=""
          class="wallet-picker__icon"
        />
        {{ t('components.walletPicker.connect', { wallet: wallet.name }) }}
      </button>
    </template>
    <p
      v-else
      class="wallet-picker__hint"
    >
      {{ noWalletText }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { isSafeWalletIcon } from '@dbc-config-lab/core/features/deployment'
import type { DeployWallet } from '@dbc-config-lab/core/features/wallet'
import type { WalletPickerProps } from './types'

defineProps<WalletPickerProps>()
const emit = defineEmits<{ connect: [wallet: DeployWallet] }>()
const { t } = useI18n()
</script>

<style lang="scss">
@use '../../styles/mixins';

.wallet-picker {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: center;
}

.wallet-picker__hint {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.wallet-picker__button {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  @include mixins.control;
  @include mixins.clickable;
}

.wallet-picker__icon {
  width: var(--space-4);
  height: var(--space-4);
}
</style>
