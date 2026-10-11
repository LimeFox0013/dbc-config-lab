<template>
  <main class="account-view">
    <header class="account-view__header">
      <RouterLink
        to="/"
        class="account-view__link"
      >
        {{ t('views.account.back') }}
      </RouterLink>
      <h1 class="account-view__title">
        {{ t('views.account.title') }}
      </h1>
      <p class="account-view__subtitle">
        {{ t('views.account.subtitle') }}
      </p>
    </header>

    <p
      v-if="loading"
      class="account-view__hint"
    >
      {{ t('views.account.loading') }}
    </p>
    <template v-else>
      <RefusalNotice :failure="failure" />
      <p
        v-if="connectError"
        class="account-view__error"
        role="alert"
      >
        {{ connectError }}
      </p>

      <AccountSignIn
        v-if="!account"
        :client="client"
        :wallets="wallets"
        :connected="connected"
        @connect="connect"
        @signed-in="account = $event"
      />
      <template v-else>
        <div class="account-view__identity">
          <p class="account-view__hint">
            {{ t('views.account.signedInAs', { address: account.walletAddress }) }}
          </p>
          <button
            type="button"
            class="account-view__button"
            @click="signOut"
          >
            {{ t('views.account.signOut') }}
          </button>
        </div>
        <AccountPlan
          :client="client"
          :account="account"
          :wallets="wallets"
          :connected="connected"
          @connect="connect"
          @credited="load"
        />
        <AccountKeys :client="client" />
        <AccountWatches
          :client="client"
          @changed="load"
        />
        <AccountWebhooks :client="client" />
      </template>
    </template>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import {
  accountApiUrl,
  createAccountClient,
  UNAUTHORIZED_STATUS,
} from '@dbc-config-lab/core/features/account'
import type { AccountView, ApiFailure } from '@dbc-config-lab/core/features/account'
import { useWalletSession } from '@dbc-config-lab/core/features/wallet'
import { AccountKeys } from '../components/AccountKeys'
import { AccountPlan } from '../components/AccountPlan'
import { AccountSignIn } from '../components/AccountSignIn'
import { AccountWatches } from '../components/AccountWatches'
import { AccountWebhooks } from '../components/AccountWebhooks'
import { RefusalNotice } from '../components/RefusalNotice'
import { useWalletConnect } from '../composables'

/**
 * `account-page`: signed out, only signing in with a wallet; signed in, the plan and
 * usage, API keys, watches and webhook addresses. The session is the service's
 * http-only cookie — the page only ever asks the service whether it is signed in.
 */
const { t } = useI18n()
const client = createAccountClient(accountApiUrl(import.meta.env.VITE_DBC_LAB_API_URL))
const { wallets, connected, connect: connectWallet } = useWalletSession()
const { connectError, connect } = useWalletConnect(connectWallet)

const loading = ref(true)
const account = shallowRef<AccountView | null>(null)
const failure = shallowRef<ApiFailure | null>(null)

const load = async (): Promise<void> => {
  const result = await client.account()
  loading.value = false
  failure.value = null
  if (result.ok) account.value = result.value
  else {
    account.value = null
    // Signed out is the page's normal starting state, not a refusal to show.
    if (result.failure.status !== UNAUTHORIZED_STATUS) failure.value = result.failure
  }
}
onMounted(load)

const signOut = async (): Promise<void> => {
  const result = await client.signOut()
  if (result.ok) account.value = null
  else failure.value = result.failure
}
</script>

<style lang="scss">
@use '../styles/mixins';

.account-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

.account-view__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.account-view__title {
  margin: 0;
  font-size: var(--font-size-5);
}

.account-view__subtitle,
.account-view__hint {
  margin: 0;
  color: var(--color-muted-foreground);
}

.account-view__hint {
  font-size: var(--font-size-2);
  overflow-wrap: anywhere;
}

.account-view__link {
  color: var(--color-gain);
  font-size: var(--font-size-2);
}

.account-view__error {
  margin: 0;
  color: var(--color-loss);
  font-size: var(--font-size-2);
}

.account-view__identity {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
}

.account-view__button {
  @include mixins.control;
  @include mixins.clickable;
}
</style>
