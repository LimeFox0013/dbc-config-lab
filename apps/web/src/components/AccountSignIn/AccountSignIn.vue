<template>
  <section class="account-sign-in">
    <h2 class="account-sign-in__title">
      {{ t('components.accountSignIn.title') }}
    </h2>
    <p class="account-sign-in__hint">
      {{ t('components.accountSignIn.intro') }}
    </p>
    <WalletPicker
      :wallets="wallets"
      :connected="connected"
      :disabled="signingIn"
      :no-wallet-text="t('components.accountSignIn.noWallet')"
      @connect="emit('connect', $event)"
    />
    <button
      v-if="connected"
      type="button"
      class="account-sign-in__button"
      :disabled="signingIn"
      @click="signIn"
    >
      {{ signingIn ? t('components.accountSignIn.signingIn') : t('components.accountSignIn.signIn') }}
    </button>
    <p
      v-if="stopped"
      class="account-sign-in__error"
      role="alert"
    >
      {{ stopped }}
    </p>
    <RefusalNotice :failure="failure" />
  </section>
</template>

<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { signInWithWallet } from '@dbc-config-lab/core/features/account'
import type { AccountView, ApiFailure } from '@dbc-config-lab/core/features/account'
import type { DeployWallet } from '@dbc-config-lab/core/features/wallet'
import { RefusalNotice } from '../RefusalNotice'
import { WalletPicker } from '../WalletPicker'
import type { AccountSignInProps } from './types'

/** `wallet-sign-in`: connect a wallet, sign the service's challenge, get a session. */
const props = defineProps<AccountSignInProps>()
const emit = defineEmits<{ connect: [wallet: DeployWallet], signedIn: [account: AccountView] }>()
const { t } = useI18n()

const signingIn = ref(false)
const failure = shallowRef<ApiFailure | null>(null)
const stopped = ref<string | null>(null)

const signIn = async (): Promise<void> => {
  const connected = props.connected
  if (!connected) return
  signingIn.value = true
  failure.value = null
  stopped.value = null
  const result = await signInWithWallet(props.client, connected)
  signingIn.value = false
  if (result.ok) emit('signedIn', result.value)
  else if ('stop' in result)
    stopped.value = t(`components.accountSignIn.stops.${result.stop}`, {
      wallet: connected.wallet.name,
      detail: result.detail ?? '',
    })
  else failure.value = result.failure
}
</script>

<style lang="scss">
@use '../../styles/mixins';

.account-sign-in {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  @include mixins.surface;
}

.account-sign-in__title {
  margin: 0;
  font-size: var(--font-size-3);
}

.account-sign-in__hint {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.account-sign-in__button {
  align-self: flex-start;
  @include mixins.control;
  @include mixins.clickable;
}

.account-sign-in__error {
  margin: 0;
  color: var(--color-loss);
  font-size: var(--font-size-2);
}
</style>
