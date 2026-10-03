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
      <header class="launch-view__header">
        <img
          v-if="logo && !logoFailed"
          :src="logo"
          alt=""
          class="launch-view__logo"
          referrerpolicy="no-referrer"
          @error="logoFailed = true"
        />
        <div class="launch-view__identity">
          <h1 class="launch-view__title">
            {{ name || t('views.launch.unbranded', { address: shortAddress(state.config.feeClaimer) }) }}
          </h1>
          <p
            v-if="name"
            class="launch-view__hint"
          >
            {{ t('views.launch.unverified') }}
            <a
              v-if="website"
              :href="website"
              target="_blank"
              rel="noopener noreferrer nofollow"
              class="launch-view__link"
            >{{ brandingHost(website) }}</a>
          </p>
          <p
            v-else
            class="launch-view__hint"
          >
            {{ t('views.launch.noBranding') }}
          </p>
          <dl class="launch-view__terms">
            <dt>{{ t('views.launch.feeWallet') }}</dt>
            <dd class="launch-view__value launch-view__address">
              <a
                :href="explorerAddressUrl(state.config.feeClaimer, state.config.network)"
                target="_blank"
                rel="noopener noreferrer"
                class="launch-view__link launch-view__link--plain"
              >{{ state.config.feeClaimer }}</a>
            </dd>
            <template v-if="state.royalty">
              <dt>{{ t('views.launch.royalty') }}</dt>
              <dd class="launch-view__value launch-view__address">
                {{
                  t('views.launch.royaltyValue', {
                    operator: state.royalty.deployerPercent,
                    operatorAddress: state.royalty.deployer,
                    author: state.royalty.authorPercent,
                    authorAddress: state.royalty.author,
                  })
                }}
              </dd>
            </template>
            <dt>{{ t('views.launch.config') }}</dt>
            <dd class="launch-view__value launch-view__address">
              <a
                :href="explorerAddressUrl(state.config.configAddress, state.config.network)"
                target="_blank"
                rel="noopener noreferrer"
                class="launch-view__link launch-view__link--plain"
              >{{ state.config.configAddress }}</a>
            </dd>
            <dt>{{ t('views.launch.network') }}</dt>
            <dd class="launch-view__value">
              {{ state.config.network }}
            </dd>
          </dl>
        </div>
      </header>

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
import { useRoute } from 'vue-router'
import { ComparisonTable } from '../components/ComparisonTable'
import { ConfigTermsRows } from '../components/ConfigTermsRows'
import { PoolLaunch } from '../components/PoolLaunch'
import { WalletAcknowledgement, WalletBar } from '../components/WalletBar'
import { configTerms, explorerAddressUrl } from '../core/config-deploy'
import { feeScheduleOf } from '../core/launch-simulator'
import { brandingHost, displayBrandingName, safeBrandingUrl } from '../core/partner-branding'
import { shortAddress } from '../core/shared'
import { DEFAULT_SCENARIO } from '../core/sniper-scenario'
import { compareConfigs, parametersEntry } from '../features/comparison'
import { useFeeScheduleText } from '../features/fee-text'
import { LaunchPageStatus, networkFromQuery, useLaunchPage } from '../features/launch-page'
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
/** A logo that does not load is left out rather than shown broken. */
const logoFailed = ref(false)

const ready = computed(() => (state.value.status === LaunchPageStatus.Ready ? state.value : null))
const name = computed(() => (ready.value?.branding ? displayBrandingName(ready.value.branding.name) : ''))
const logo = computed(() => (ready.value?.branding ? safeBrandingUrl(ready.value.branding.logo) : null))
const website = computed(() => (ready.value?.branding ? safeBrandingUrl(ready.value.branding.website) : null))
const schedule = computed(() => (ready.value ? feeScheduleOf(ready.value.config.parameters) : null))
const terms = computed(() =>
  ready.value ? configTerms(ready.value.config.parameters, ready.value.config.quoteToken) : null,
)
/** A typical launch: the lab's default launch situation, run against this config. */
const rows = computed(() =>
  ready.value ?
      compareConfigs(
        [
          parametersEntry(
            { id: ready.value.config.configAddress, name: t('views.launch.typicalName'), intent: '' },
            ready.value.config.parameters,
            ready.value.config.quoteToken,
          ),
        ],
        DEFAULT_SCENARIO,
      ) :
      [],
)
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

.launch-view__header {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
}

.launch-view__logo {
  width: var(--logo-size);
  height: var(--logo-size);
  border-radius: var(--radius-2);
  object-fit: cover;
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

.launch-view__link {
  margin-left: var(--space-2);
  color: var(--color-gain);
  overflow-wrap: anywhere;
}

.launch-view__link--plain {
  margin-left: 0;
}

.launch-view__identity {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.launch-view__address {
  overflow-wrap: anywhere;
}

.launch-view__terms {
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

.launch-view__value {
  font-family: var(--font-family-mono);
}
</style>
