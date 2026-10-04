<template>
  <main class="act-view">
    <section
      v-if="!decoded.ok"
      class="act-view__section"
    >
      <h1 class="act-view__title">
        {{ t('views.act.refusedTitle') }}
      </h1>
      <p
        class="act-view__error"
        role="alert"
      >
        {{ t(`views.act.rejections.${decoded.rejection}`, { detail: decoded.detail ?? '' }) }}
      </p>
    </section>

    <template v-else>
      <section class="act-view__section">
        <h1 class="act-view__title">
          {{ t(`views.act.titles.${decoded.intent.action}`) }}
        </h1>
        <p class="act-view__hint">
          {{ t('views.act.intro') }}
        </p>
        <dl class="act-view__terms">
          <dt>{{ t('views.act.network') }}</dt>
          <dd class="act-view__value act-view__value--network">
            {{ decoded.intent.network }}
          </dd>
          <dt>{{ t('views.act.owner') }}</dt>
          <dd class="act-view__value">
            {{ decoded.intent.owner }}
          </dd>
        </dl>
      </section>

      <section class="act-view__section">
        <WalletBar
          v-model:network="session.network.value"
          v-model:acknowledged="session.mainnetAcknowledged.value"
          :wallets="session.wallets.value"
          :connected="session.connected.value"
          :acknowledgement="acknowledgement"
          :disabled="busy"
          network-locked
          @connect="connect"
        />
        <p
          v-if="connectError"
          class="act-view__error"
          role="alert"
        >
          {{ connectError }}
        </p>

        <p
          v-if="!session.connected.value"
          class="act-view__hint"
        >
          {{ t('views.act.connectOwner', { owner: decoded.intent.owner }) }}
        </p>
        <p
          v-else-if="!ownerConnected"
          class="act-view__error"
          role="alert"
        >
          {{ t('views.act.wrongWallet', { owner: decoded.intent.owner }) }}
        </p>

        <template v-else>
          <ConfigDeploy
            v-if="deployTarget"
            :target="deployTarget"
            :network="session.network.value"
            :connected="session.connected.value"
            :mainnet-acknowledged="session.mainnetAcknowledged.value"
            @busy="busy = $event"
          />
          <template v-else-if="decoded.intent.action === HandoffAction.Clone">
            <p
              v-if="cloneState.status === CloneStatus.Loading"
              class="act-view__hint"
            >
              {{ t('views.act.cloneLoading') }}
            </p>
            <p
              v-else-if="cloneState.status === CloneStatus.Refused"
              class="act-view__error"
              role="alert"
            >
              {{ t('views.act.cloneRefused', { reason: cloneState.reason }) }}
            </p>
            <ConfigDeploy
              v-else
              :target="cloneState.target"
              :network="session.network.value"
              :connected="session.connected.value"
              :mainnet-acknowledged="session.mainnetAcknowledged.value"
              @busy="busy = $event"
            />
          </template>
          <BrandingSection
            v-else-if="decoded.intent.action === HandoffAction.Branding"
            :network="session.network.value"
            :connected="session.connected.value"
            :mainnet-acknowledged="session.mainnetAcknowledged.value"
            :initial-branding="decoded.intent.branding"
            config-address=""
            @busy="busy = $event"
          />
          <PoolLaunch
            v-else-if="decoded.intent.action === HandoffAction.Launch"
            :network="session.network.value"
            :connected="session.connected.value"
            :mainnet-acknowledged="session.mainnetAcknowledged.value"
            :initial-config-address="decoded.intent.configAddress"
            :initial-metadata="decoded.intent.metadata"
            :initial-first-buy="decoded.intent.firstBuy"
            config-locked
            @busy="busy = $event"
          />
          <EarningsSection
            v-else
            :network="session.network.value"
            :connected="session.connected.value"
            :mainnet-acknowledged="session.mainnetAcknowledged.value"
            @busy="busy = $event"
          />
        </template>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { BrandingSection } from '../components/BrandingSection'
import { ConfigDeploy } from '../components/ConfigDeploy'
import { EarningsSection } from '../components/EarningsSection'
import { PoolLaunch } from '../components/PoolLaunch'
import { WalletAcknowledgement, WalletBar } from '../components/WalletBar'
import {
  CloneStatus,
  decodeHandoff,
  HandoffAction,
  handoffDeployTarget,
  useHandoffClone,
} from '../features/agent-handoff'
import type { CloneSource } from '../features/agent-handoff'
import type { DeployTarget } from '../features/deployment'
import { shortAddress } from '../core/shared'
import { useWalletSession } from '../features/wallet'
import type { DeployWallet } from '../features/wallet'

const { t } = useI18n()
const route = useRoute()
const decoded = computed(() => decodeHandoff(route.hash))

const session = useWalletSession()
watch(
  decoded,
  (current) => {
    if (current.ok) session.network.value = current.intent.network
  },
  { immediate: true },
)
const connectError = ref<string | null>(null)
const connect = async (wallet: DeployWallet): Promise<void> => {
  connectError.value = await session.connect(wallet)
}
/** The action is being prepared or signed; the wallet must not change meanwhile. */
const busy = ref(false)

/** Only the wallet the agent named may sign what it proposed. */
const ownerConnected = computed(
  () =>
    decoded.value.ok &&
    session.connected.value?.owner.toBase58() === decoded.value.intent.owner,
)
const acknowledgement = computed(() =>
  decoded.value.ok && decoded.value.intent.action === HandoffAction.Launch ?
    WalletAcknowledgement.Launch :
    WalletAcknowledgement.Deploy,
)
/** Built once per link: a new target object would drop what was prepared for the old one. */
const deployTarget = computed<DeployTarget | null>(() => {
  if (!decoded.value.ok || decoded.value.intent.action !== HandoffAction.Deploy) return null
  const { shared } = decoded.value.intent
  return handoffDeployTarget(shared, {
    name: shared.name ?? t('views.act.configName'),
    intent: t('views.act.configIntent'),
  })
})

const cloneSource = computed<CloneSource | null>(() => {
  if (!decoded.value.ok || decoded.value.intent.action !== HandoffAction.Clone) return null
  const { sourceAddress, sourceNetwork, adjustments } = decoded.value.intent
  return { sourceAddress, sourceNetwork, adjustments }
})
/** The clone is rebuilt from the original read on chain, not from anything in the link. */
const cloneState = useHandoffClone(cloneSource, (configAddress) => ({
  name: t('views.act.cloneName', { address: shortAddress(configAddress) }),
  intent: t('views.act.configIntent'),
}))
</script>

<style lang="scss">
@use '../styles/mixins';

.act-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

.act-view__title {
  margin: 0;
  font-size: var(--font-size-5);
  overflow-wrap: anywhere;
}

.act-view__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  @include mixins.surface;
}

.act-view__hint {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
  overflow-wrap: anywhere;
}

.act-view__error {
  margin: 0;
  color: var(--color-loss);
  font-size: var(--font-size-2);
  overflow-wrap: anywhere;
}

.act-view__terms {
  @include mixins.term-list;
}

.act-view__value {
  font-family: var(--font-family-mono);
  overflow-wrap: anywhere;
}

.act-view__value--network {
  color: var(--color-loss);
  font-weight: var(--font-weight-strong);
}
</style>
