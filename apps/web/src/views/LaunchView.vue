<template>
  <main class="launch-view">
    <p
      v-if="state.status === LaunchPageStatus.Loading"
      class="launch-view__hint"
    >
      {{ t('views.launch.loading') }}
    </p>

    <section
      v-else-if="state.status === LaunchPageStatus.Refused"
      class="launch-view__section"
    >
      <h1 class="launch-view__title">
        {{ t('views.launch.refusedTitle') }}
      </h1>
      <p
        class="launch-view__error"
        role="alert"
      >
        {{ t(`common.loadRejections.${state.rejection}`, { detail: state.detail ?? '' }) }}
      </p>
    </section>

    <template v-else>
      <LaunchpadIdentity
        :config="state.config"
        :branding="state.branding"
        :royalty="state.royalty"
      />

      <section class="launch-view__section">
        <h2 class="launch-view__heading">
          {{ t('views.launch.termsTitle') }}
        </h2>
        <dl class="launch-view__terms">
          <template v-if="schedule">
            <dt>{{ t('views.launch.fee') }}</dt>
            <dd class="launch-view__value">
              {{ feeScheduleText(schedule) }}
            </dd>
          </template>
          <ConfigTermsRows
            v-if="terms"
            :terms="terms"
          />
        </dl>
        <RouterLink
          :to="reportPagePath(state.config.configAddress, state.config.network)"
          class="launch-view__report-link"
        >
          {{ t('views.launch.reportLink') }}
        </RouterLink>
      </section>

      <section class="launch-view__section">
        <h2 class="launch-view__heading">
          {{ t('views.launch.typicalTitle') }}
        </h2>
        <p class="launch-view__hint">
          {{ t('views.launch.typicalIntro') }}
        </p>
        <ComparisonTable :rows="rows" />
      </section>

      <section class="launch-view__section">
        <h2 class="launch-view__heading">
          {{ t('views.launch.launchTitle') }}
        </h2>
        <WalletBar
          v-model:network="session.network.value"
          v-model:acknowledged="session.mainnetAcknowledged.value"
          :wallets="session.wallets.value"
          :connected="session.connected.value"
          :acknowledgement="WalletAcknowledgement.Launch"
          :disabled="launchBusy"
          network-locked
          @connect="connect"
        />
        <p
          v-if="connectError"
          class="launch-view__error"
          role="alert"
        >
          {{ connectError }}
        </p>
        <PoolLaunch
          :network="session.network.value"
          :connected="session.connected.value"
          :mainnet-acknowledged="session.mainnetAcknowledged.value"
          :initial-config-address="state.config.configAddress"
          config-locked
          @busy="launchBusy = $event"
        />
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { ComparisonTable } from '../components/ComparisonTable'
import { ConfigTermsRows } from '../components/ConfigTermsRows'
import { LaunchpadIdentity } from '../components/LaunchpadIdentity'
import { PoolLaunch } from '../components/PoolLaunch'
import { WalletAcknowledgement, WalletBar } from '../components/WalletBar'
import { configTerms } from '../core/config-deploy'
import { feeScheduleOf } from '../core/launch-simulator'
import { typicalLaunchRow } from '../features/config-report'
import { useFeeScheduleText } from '../features/fee-text'
import { LaunchPageStatus, networkFromQuery, reportPagePath, useLaunchPage } from '../features/launch-page'
import { useWalletSession } from '../features/wallet'
import type { DeployWallet } from '../features/wallet'
import { NETWORK_QUERY_KEY } from '../router'

const { t } = useI18n()
const feeScheduleText = useFeeScheduleText()
const route = useRoute()
const network = computed(() => networkFromQuery(route.query[NETWORK_QUERY_KEY]))
const configAddress = computed(() => String(route.params.config ?? ''))
const { state } = useLaunchPage(network, configAddress)

const session = useWalletSession()
watch(network, (current) => {
  session.network.value = current
}, { immediate: true })
const connectError = ref<string | null>(null)
const connect = async (wallet: DeployWallet): Promise<void> => {
  connectError.value = await session.connect(wallet)
}
const launchBusy = ref(false)

const ready = computed(() => (state.value.status === LaunchPageStatus.Ready ? state.value : null))
const schedule = computed(() => (ready.value ? feeScheduleOf(ready.value.config.parameters) : null))
const terms = computed(() =>
  ready.value ? configTerms(ready.value.config.parameters, ready.value.config.quoteToken) : null,
)
/** A typical launch: the lab's default launch situation, run against this config. */
const rows = computed(() => (ready.value ? [typicalLaunchRow(ready.value.config, t('views.launch.typicalName'))] : []))
</script>

<style lang="scss">
@use '../styles/mixins';

.launch-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

.launch-view__title {
  margin: 0;
  font-size: var(--font-size-5);
  overflow-wrap: anywhere;
}

.launch-view__heading {
  margin: 0;
  font-size: var(--font-size-3);
}

.launch-view__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  @include mixins.surface;
}

.launch-view__hint {
  margin: var(--space-1) 0 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.launch-view__error {
  margin: 0;
  color: var(--color-loss);
  font-size: var(--font-size-2);
  overflow-wrap: anywhere;
}

.launch-view__terms {
  @include mixins.term-list;
}

.launch-view__report-link {
  color: var(--color-gain);
  font-size: var(--font-size-2);
}

.launch-view__value {
  font-family: var(--font-family-mono);
}
</style>
