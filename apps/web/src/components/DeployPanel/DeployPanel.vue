<template>
  <section class="deploy-panel">
    <h2 class="deploy-panel__title">
      {{ t('components.deployPanel.title') }}
    </h2>

    <div class="deploy-panel__row">
      <label class="deploy-panel__field">
        <span class="deploy-panel__label">{{ t('components.deployPanel.preset') }}</span>
        <select
          v-model="targetId"
          class="deploy-panel__select"
          :disabled="busy || launchBusy || claimBusy || brandingBusy"
        >
          <option
            v-for="option in targets"
            :key="option.id"
            :value="option.id"
          >
            {{ option.name }}
          </option>
        </select>
      </label>
    </div>

    <WalletBar
      v-model:network="network"
      v-model:acknowledged="mainnetAcknowledged"
      :wallets="wallets"
      :connected="connected"
      :acknowledgement="WalletAcknowledgement.Deploy"
      :disabled="busy || launchBusy || claimBusy || brandingBusy"
      @connect="connect"
    />

    <button
      v-if="step !== DeployStep.Ready && step !== DeployStep.Signing && step !== DeployStep.Done"
      type="button"
      class="deploy-panel__button deploy-panel__button--primary"
      :disabled="!prepareAllowed || step === DeployStep.Preparing"
      @click="prepare"
    >
      {{ step === DeployStep.Preparing ? t('common.signing.preparing') : t('components.deployPanel.prepare') }}
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
      <template v-if="prepared.summary.royalty">
        <dt>{{ t('components.deployPanel.summary.royalty') }}</dt>
        <dd class="deploy-panel__value">
          {{
            t('components.deployPanel.summary.royaltyValue', {
              you: prepared.summary.royalty.deployerPercent,
              author: prepared.summary.royalty.authorPercent,
              address: prepared.summary.royalty.author,
            })
          }}
        </dd>
        <dt>{{ t('components.deployPanel.summary.royaltyLiquidity') }}</dt>
        <dd class="deploy-panel__value deploy-panel__value--warning">
          {{ t('components.deployPanel.summary.royaltyLiquidityValue') }}
        </dd>
      </template>
      <dt>{{ t('components.deployPanel.summary.leftoverReceiver') }}</dt>
      <dd class="deploy-panel__value">
        {{ prepared.summary.leftoverReceiver }}
      </dd>
      <dt>{{ t('components.deployPanel.summary.quoteMint') }}</dt>
      <dd class="deploy-panel__value">
        {{
          t('components.deployPanel.summary.quoteMintValue', {
            symbol: QUOTE_TOKENS[prepared.summary.quoteToken].symbol,
            mint: prepared.summary.quoteMint,
          })
        }}
      </dd>
      <dt>{{ t('components.deployPanel.summary.fee') }}</dt>
      <dd class="deploy-panel__value">
        {{
          feeScheduleText({
            startingFeeBps: prepared.summary.startingFeeBps,
            endingFeeBps: prepared.summary.endingFeeBps,
            windowSeconds: prepared.summary.feeWindowSeconds,
          })
        }}
      </dd>
      <ConfigTermsRows :terms="prepared.summary" />
    </dl>

    <button
      v-if="step === DeployStep.Ready || step === DeployStep.Signing"
      type="button"
      class="deploy-panel__button deploy-panel__button--primary"
      :disabled="step === DeployStep.Signing"
      @click="signAndSend"
    >
      {{ step === DeployStep.Signing ? t('common.signing.signing') : t('common.signing.sign') }}
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
      >{{ t('common.signing.viewTransaction') }}</a>
    </p>

    <p
      v-if="error"
      class="deploy-panel__error"
      role="alert"
    >
      {{ error }}
    </p>

    <PoolLaunch
      :network="network"
      :connected="connected"
      :mainnet-acknowledged="mainnetAcknowledged"
      :initial-config-address="deployedConfigAddress"
      @busy="launchBusy = $event"
    />
    <BrandingSection
      :network="network"
      :connected="connected"
      :mainnet-acknowledged="mainnetAcknowledged"
      :config-address="deployedConfigAddress"
      @busy="brandingBusy = $event"
    />
    <EarningsSection
      :network="network"
      :connected="connected"
      :mainnet-acknowledged="mainnetAcknowledged"
      @busy="claimBusy = $event"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { explorerAddressUrl, explorerTransactionUrl } from '../../core/config-deploy'
import { QUOTE_TOKENS } from '../../core/quote-token'
import { DeployStep, useDeployment } from '../../features/deployment'
import { useFeeScheduleText } from '../../features/fee-text'
import type { DeployTarget } from '../../features/deployment'
import { ConfigTermsRows } from '../ConfigTermsRows'
import { WalletAcknowledgement, WalletBar } from '../WalletBar'
import BrandingSection from './BrandingSection.vue'
import EarningsSection from './EarningsSection.vue'
import { PoolLaunch } from '../PoolLaunch'
import type { DeployPanelProps } from './types'

const props = defineProps<DeployPanelProps>()
const { t } = useI18n()
const feeScheduleText = useFeeScheduleText()

const targetId = ref<DeployTarget['id']>(props.initialTargetId)
const target = computed<DeployTarget>(() => {
  const found = props.targets.find((candidate) => candidate.id === targetId.value)
  if (!found) throw new Error(`Unknown config ${targetId.value}`)
  return found
})

const {
  busy,
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
} = useDeployment(target)

/** A token launch is being prepared or signed on the panel's network and wallet. */
const launchBusy = ref(false)
/** A fee claim is being prepared or signed on the panel's network and wallet. */
const claimBusy = ref(false)
/** Branding is being prepared or signed on the panel's network and wallet. */
const brandingBusy = ref(false)

/** The last config deployed here, offered as the one to launch a token on. */
const deployedConfigAddress = ref('')
// A config exists on the network it was deployed to; on another it would be offered in vain.
watch(network, () => {
  deployedConfigAddress.value = ''
})
watch(step, (current) => {
  if (current === DeployStep.Done && prepared.value) deployedConfigAddress.value = prepared.value.summary.configAddress
})
</script>

<style lang="scss">
@use '../../styles/mixins';

.deploy-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  @include mixins.surface;
}

.deploy-panel__title {
  margin: 0;
  font-size: var(--font-size-3);
}

.deploy-panel__row {
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

.deploy-panel__label {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.deploy-panel__select,
.deploy-panel__button {
  @include mixins.control;
}

.deploy-panel__button {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  align-self: flex-start;
  @include mixins.clickable;
}

.deploy-panel__button--primary:enabled {
  border-color: var(--color-gain);
}

.deploy-panel__summary {
  @include mixins.term-list;
}

.deploy-panel__value {
  font-family: var(--font-family-mono);
  overflow-wrap: anywhere;
}

.deploy-panel__value--network {
  color: var(--color-loss);
  font-weight: var(--font-weight-strong);
}

.deploy-panel__value--warning {
  color: var(--color-loss);
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
