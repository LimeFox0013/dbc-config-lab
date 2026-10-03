<template>
  <section class="pool-launch">
    <h3 class="pool-launch__title">
      {{ t('components.deployPanel.launch.title') }}
    </h3>
    <p class="pool-launch__hint">
      {{ t('components.deployPanel.launch.intro') }}
    </p>

    <div class="pool-launch__fields">
      <label class="pool-launch__field pool-launch__field--wide">
        <span class="pool-launch__label">{{ t('components.deployPanel.launch.config') }}</span>
        <input
          v-model.trim="configAddress"
          class="pool-launch__input"
          type="text"
          spellcheck="false"
          :maxlength="MAX_ADDRESS_LENGTH"
          :disabled="inputsLocked"
        />
      </label>
      <label class="pool-launch__field">
        <span class="pool-launch__label">{{ t('components.deployPanel.launch.name') }}</span>
        <input
          v-model="metadata.name"
          class="pool-launch__input"
          type="text"
          :maxlength="METADATA_LIMITS.name"
          :disabled="inputsLocked"
        />
      </label>
      <label class="pool-launch__field">
        <span class="pool-launch__label">{{ t('components.deployPanel.launch.symbol') }}</span>
        <input
          v-model="metadata.symbol"
          class="pool-launch__input"
          type="text"
          :maxlength="METADATA_LIMITS.symbol"
          :disabled="inputsLocked"
        />
      </label>
      <label class="pool-launch__field pool-launch__field--wide">
        <span class="pool-launch__label">{{ t('components.deployPanel.launch.uri') }}</span>
        <input
          v-model="metadata.uri"
          class="pool-launch__input"
          type="url"
          :maxlength="METADATA_LIMITS.uri"
          :disabled="inputsLocked"
        />
      </label>
      <label class="pool-launch__field">
        <span class="pool-launch__label">{{ t('components.deployPanel.launch.firstBuy') }}</span>
        <input
          v-model.number="firstBuy"
          class="pool-launch__input"
          type="number"
          min="0"
          step="any"
          :disabled="inputsLocked"
        />
      </label>
    </div>

    <p
      v-if="rejection && (metadata.name || metadata.symbol || metadata.uri)"
      class="pool-launch__hint"
    >
      {{ t(`components.deployPanel.launch.rejections.${rejection}`) }}
    </p>

    <button
      v-if="step !== DeployStep.Ready && step !== DeployStep.Signing && step !== DeployStep.Done"
      type="button"
      class="pool-launch__button pool-launch__button--primary"
      :disabled="!prepareAllowed || step === DeployStep.Preparing"
      @click="prepare"
    >
      {{ step === DeployStep.Preparing ? t('components.deployPanel.preparing') : t('components.deployPanel.launch.prepare') }}
    </button>

    <dl
      v-if="prepared && step !== DeployStep.Done"
      class="pool-launch__summary"
    >
      <dt>{{ t('components.deployPanel.summary.network') }}</dt>
      <dd class="pool-launch__value pool-launch__value--network">
        {{ prepared.summary.network }}
      </dd>
      <dt>{{ t('components.deployPanel.launch.summary.token') }}</dt>
      <dd class="pool-launch__value">
        {{ t('components.deployPanel.launch.summary.tokenValue', { name: prepared.summary.metadata.name, symbol: prepared.summary.metadata.symbol }) }}
      </dd>
      <dt>{{ t('components.deployPanel.launch.summary.mint') }}</dt>
      <dd class="pool-launch__value">
        {{ prepared.summary.mintAddress }}
      </dd>
      <dt>{{ t('components.deployPanel.launch.summary.pool') }}</dt>
      <dd class="pool-launch__value">
        {{ prepared.summary.poolAddress }}
      </dd>
      <dt>{{ t('components.deployPanel.launch.config') }}</dt>
      <dd class="pool-launch__value">
        {{ prepared.summary.configAddress }}
      </dd>
      <dt>{{ t('components.deployPanel.launch.summary.creator') }}</dt>
      <dd class="pool-launch__value">
        {{ prepared.summary.creator }}
      </dd>
      <dt>{{ t('components.deployPanel.launch.uri') }}</dt>
      <dd class="pool-launch__value">
        {{ prepared.summary.metadata.uri || t('components.deployPanel.launch.summary.noUri') }}
      </dd>
      <ConfigTermsRows :terms="prepared.summary.terms" />
      <dt>{{ t('components.deployPanel.launch.firstBuy') }}</dt>
      <dd
        class="pool-launch__value"
        :class="{ 'pool-launch__value--warning': highFee }"
      >
        <template v-if="prepared.summary.firstBuy">
          {{
            t('components.deployPanel.launch.summary.firstBuyValue', {
              amount: prepared.summary.firstBuy.amount,
              symbol: QUOTE_TOKENS[prepared.summary.quoteToken].symbol,
              tokens: tokenFormat.format(prepared.summary.firstBuy.expectedTokens),
              minimum: tokenFormat.format(prepared.summary.firstBuy.minimumTokens),
              fee: prepared.summary.firstBuy.baseFeeBps / 100,
            })
          }}
          <span v-if="prepared.summary.firstBuy.atMinimumFee">{{ t('components.deployPanel.launch.summary.atMinimumFee') }}</span>
        </template>
        <template v-else>
          {{ t('components.deployPanel.launch.summary.noFirstBuy') }}
        </template>
      </dd>
    </dl>

    <p
      v-if="prepared && prepared.summary.terms.poolCreationFeeSol > 0 && step !== DeployStep.Done"
      class="pool-launch__error"
      role="alert"
    >
      {{ t('components.deployPanel.launch.creationFee', { sol: prepared.summary.terms.poolCreationFeeSol }) }}
    </p>
    <p
      v-if="prepared && PARTNER_AUTHORITY_OPTIONS.has(prepared.summary.terms.tokenAuthority) && step !== DeployStep.Done"
      class="pool-launch__error"
      role="alert"
    >
      {{ t('components.deployPanel.launch.partnerAuthority') }}
    </p>
    <p
      v-if="prepared && highFee && step !== DeployStep.Done"
      class="pool-launch__error"
      role="alert"
    >
      {{ t('components.deployPanel.launch.highFee', { fee: (prepared.summary.firstBuy?.baseFeeBps ?? 0) / 100 }) }}
    </p>

    <button
      v-if="step === DeployStep.Ready || step === DeployStep.Signing"
      type="button"
      class="pool-launch__button pool-launch__button--primary"
      :disabled="step === DeployStep.Signing"
      @click="signAndSend"
    >
      {{ step === DeployStep.Signing ? t('components.deployPanel.signing') : t('components.deployPanel.sign') }}
    </button>

    <p
      v-if="step === DeployStep.Done && signature && prepared"
      class="pool-launch__done"
    >
      {{ t('components.deployPanel.launch.done') }}
      <a
        :href="explorerAddressUrl(prepared.summary.mintAddress, network)"
        target="_blank"
        rel="noopener noreferrer"
        class="pool-launch__link"
      >{{ t('components.deployPanel.launch.viewToken') }}</a>
      <a
        :href="explorerAddressUrl(prepared.summary.poolAddress, network)"
        target="_blank"
        rel="noopener noreferrer"
        class="pool-launch__link"
      >{{ t('components.deployPanel.launch.viewPool') }}</a>
      <a
        :href="explorerTransactionUrl(signature, network)"
        target="_blank"
        rel="noopener noreferrer"
        class="pool-launch__link"
      >{{ t('components.deployPanel.viewTransaction') }}</a>
    </p>

    <p
      v-if="error"
      class="pool-launch__error"
      role="alert"
    >
      {{ error }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, toRefs, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { explorerAddressUrl, explorerTransactionUrl } from '../../core/config-deploy'
import { METADATA_LIMITS, PARTNER_AUTHORITY_OPTIONS } from '../../core/pool-launch'
import { QUOTE_TOKENS } from '../../core/quote-token'
import { DeployStep } from '../../features/deployment'
import { MAX_ADDRESS_LENGTH } from '../../features/onchain-config'
import { usePoolLaunch } from '../../features/pool-launch'
import { ConfigTermsRows } from '../ConfigTermsRows'
import { HIGH_FIRST_BUY_FEE_BPS } from './constants'
import type { PoolLaunchSectionProps } from './types'

const props = defineProps<PoolLaunchSectionProps>()
/** The panel's network and wallet must not change while a launch is prepared or signed. */
const emit = defineEmits<{ busy: [busy: boolean] }>()
const { t } = useI18n()
const { network, connected, mainnetAcknowledged, initialConfigAddress } = toRefs(props)

const {
  configAddress,
  metadata,
  firstBuy,
  rejection,
  prepared,
  step,
  error,
  signature,
  prepareAllowed,
  prepare,
  signAndSend,
} = usePoolLaunch({ network, connected, mainnetAcknowledged }, initialConfigAddress)

const inputsLocked = computed(() => step.value === DeployStep.Preparing || step.value === DeployStep.Signing)
watch(inputsLocked, (busy) => emit('busy', busy))

/** A first buy paying an anti-sniper fee is almost always a mistake worth stating. */
const highFee = computed(() => (prepared.value?.summary.firstBuy?.baseFeeBps ?? 0) >= HIGH_FIRST_BUY_FEE_BPS)

const tokenFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
</script>

<style lang="scss">
.pool-launch {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: var(--border-width-1) solid var(--color-border);
}

.pool-launch__title {
  margin: 0;
  font-size: var(--font-size-3);
}

.pool-launch__fields {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.pool-launch__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.pool-launch__field--wide {
  flex-basis: 100%;
}

.pool-launch__label,
.pool-launch__hint {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.pool-launch__input,
.pool-launch__button {
  padding: var(--space-2) var(--space-3);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-background);
  color: var(--color-background-foreground);
  font-family: var(--font-family);
  font-size: var(--font-size-2);
}

.pool-launch__button {
  align-self: flex-start;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    color: var(--color-muted-foreground);
  }
}

.pool-launch__button--primary:enabled {
  border-color: var(--color-gain);
}

.pool-launch__summary {
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

.pool-launch__value {
  font-family: var(--font-family-mono);
  overflow-wrap: anywhere;
}

.pool-launch__value--network,
.pool-launch__value--warning {
  color: var(--color-loss);
}

.pool-launch__done {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin: 0;
}

.pool-launch__link {
  color: var(--color-gain);
}

.pool-launch__error {
  margin: 0;
  color: var(--color-loss);
  font-size: var(--font-size-2);
  overflow-wrap: anywhere;
}
</style>
