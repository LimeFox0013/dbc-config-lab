<template>
  <section class="pool-launch">
    <h3 class="pool-launch__title">
      {{ t('components.poolLaunch.title') }}
    </h3>
    <p class="pool-launch__hint">
      {{ t(configLocked ? 'components.poolLaunch.introLocked' : 'components.poolLaunch.intro') }}
    </p>

    <div class="pool-launch__fields">
      <label class="pool-launch__field pool-launch__field--wide">
        <span class="pool-launch__label">{{ t('components.poolLaunch.config') }}</span>
        <input
          v-model.trim="configAddress"
          class="pool-launch__input"
          type="text"
          spellcheck="false"
          :maxlength="MAX_ADDRESS_LENGTH"
          :readonly="configLocked"
          :disabled="busy"
        />
      </label>
      <label class="pool-launch__field">
        <span class="pool-launch__label">{{ t('components.poolLaunch.name') }}</span>
        <input
          v-model="metadata.name"
          class="pool-launch__input"
          type="text"
          :maxlength="METADATA_LIMITS.name"
          :disabled="busy"
        />
      </label>
      <label class="pool-launch__field">
        <span class="pool-launch__label">{{ t('components.poolLaunch.symbol') }}</span>
        <input
          v-model="metadata.symbol"
          class="pool-launch__input"
          type="text"
          :maxlength="METADATA_LIMITS.symbol"
          :disabled="busy"
        />
      </label>
      <label class="pool-launch__field pool-launch__field--wide">
        <span class="pool-launch__label">{{ t('components.poolLaunch.uri') }}</span>
        <input
          v-model="metadata.uri"
          class="pool-launch__input"
          type="url"
          :maxlength="METADATA_LIMITS.uri"
          :disabled="busy"
        />
      </label>
      <label class="pool-launch__field">
        <span class="pool-launch__label">{{ t('components.poolLaunch.firstBuy') }}</span>
        <input
          v-model.number="firstBuy"
          class="pool-launch__input"
          type="number"
          min="0"
          step="any"
          :disabled="busy"
        />
      </label>
    </div>

    <p
      v-if="rejection && (metadata.name || metadata.symbol || metadata.uri)"
      class="pool-launch__hint"
    >
      {{ t(`components.poolLaunch.rejections.${rejection}`) }}
    </p>

    <button
      v-if="step !== DeployStep.Ready && step !== DeployStep.Signing && step !== DeployStep.Done"
      type="button"
      class="pool-launch__button pool-launch__button--primary"
      :disabled="!prepareAllowed || step === DeployStep.Preparing"
      @click="prepare"
    >
      {{ step === DeployStep.Preparing ? t('common.signing.preparing') : t('components.poolLaunch.prepare') }}
    </button>

    <dl
      v-if="prepared && step !== DeployStep.Done"
      class="pool-launch__summary"
    >
      <dt>{{ t('components.deployPanel.summary.network') }}</dt>
      <dd class="pool-launch__value pool-launch__value--network">
        {{ prepared.summary.network }}
      </dd>
      <dt>{{ t('components.poolLaunch.summary.token') }}</dt>
      <dd class="pool-launch__value">
        {{ t('components.poolLaunch.summary.tokenValue', { name: prepared.summary.metadata.name, symbol: prepared.summary.metadata.symbol }) }}
      </dd>
      <dt>{{ t('components.poolLaunch.summary.mint') }}</dt>
      <dd class="pool-launch__value">
        {{ prepared.summary.mintAddress }}
      </dd>
      <dt>{{ t('components.poolLaunch.summary.pool') }}</dt>
      <dd class="pool-launch__value">
        {{ prepared.summary.poolAddress }}
      </dd>
      <dt>{{ t('components.poolLaunch.config') }}</dt>
      <dd class="pool-launch__value">
        {{ prepared.summary.configAddress }}
      </dd>
      <dt>{{ t('components.poolLaunch.summary.creator') }}</dt>
      <dd class="pool-launch__value">
        {{ prepared.summary.creator }}
      </dd>
      <dt>{{ t('components.poolLaunch.uri') }}</dt>
      <dd class="pool-launch__value">
        {{ prepared.summary.metadata.uri || t('components.poolLaunch.summary.noUri') }}
      </dd>
      <ConfigTermsRows :terms="prepared.summary.terms" />
      <dt>{{ t('components.poolLaunch.firstBuy') }}</dt>
      <dd
        class="pool-launch__value"
        :class="{ 'pool-launch__value--warning': highFee }"
      >
        <template v-if="prepared.summary.firstBuy">
          {{
            t('components.poolLaunch.summary.firstBuyValue', {
              amount: prepared.summary.firstBuy.amount,
              symbol: QUOTE_TOKENS[prepared.summary.quoteToken].symbol,
              tokens: formatCount(prepared.summary.firstBuy.expectedTokens),
              minimum: formatCount(prepared.summary.firstBuy.minimumTokens),
              fee: percentFromBps(prepared.summary.firstBuy.baseFeeBps),
            })
          }}
          <span v-if="prepared.summary.firstBuy.atMinimumFee">{{ t('components.poolLaunch.summary.atMinimumFee') }}</span>
        </template>
        <template v-else>
          {{ t('components.poolLaunch.summary.noFirstBuy') }}
        </template>
      </dd>
    </dl>

    <p
      v-if="prepared && prepared.summary.terms.poolCreationFeeSol > 0 && step !== DeployStep.Done"
      class="pool-launch__error"
      role="alert"
    >
      {{ t('components.poolLaunch.creationFee', { sol: prepared.summary.terms.poolCreationFeeSol }) }}
    </p>
    <p
      v-if="prepared && PARTNER_AUTHORITY_OPTIONS.has(prepared.summary.terms.tokenAuthority) && step !== DeployStep.Done"
      class="pool-launch__error"
      role="alert"
    >
      {{ t('components.poolLaunch.partnerAuthority') }}
    </p>
    <p
      v-if="prepared && highFee && step !== DeployStep.Done"
      class="pool-launch__error"
      role="alert"
    >
      {{ t('components.poolLaunch.highFee', { fee: percentFromBps(prepared.summary.firstBuy?.baseFeeBps ?? 0) }) }}
    </p>

    <button
      v-if="step === DeployStep.Ready || step === DeployStep.Signing"
      type="button"
      class="pool-launch__button pool-launch__button--primary"
      :disabled="step === DeployStep.Signing"
      @click="signAndSend"
    >
      {{ step === DeployStep.Signing ? t('common.signing.signing') : t('common.signing.sign') }}
    </button>

    <p
      v-if="step === DeployStep.Done && signature && prepared"
      class="pool-launch__done"
    >
      {{ t('components.poolLaunch.done') }}
      <a
        :href="explorerAddressUrl(prepared.summary.mintAddress, network)"
        target="_blank"
        rel="noopener noreferrer"
        class="pool-launch__link"
      >{{ t('components.poolLaunch.viewToken') }}</a>
      <a
        :href="explorerAddressUrl(prepared.summary.poolAddress, network)"
        target="_blank"
        rel="noopener noreferrer"
        class="pool-launch__link"
      >{{ t('components.poolLaunch.viewPool') }}</a>
      <a
        :href="explorerTransactionUrl(signature, network)"
        target="_blank"
        rel="noopener noreferrer"
        class="pool-launch__link"
      >{{ t('common.signing.viewTransaction') }}</a>
    </p>

    <p
      v-if="error"
      class="pool-launch__error"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-if="loadRejection"
      class="pool-launch__error"
      role="alert"
    >
      {{ t(`common.loadRejections.${loadRejection.rejection}`, { detail: loadRejection.detail ?? '' }) }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { formatCount, percentFromBps } from '../../core/shared'
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
import type { PoolLaunchProps } from './types'

const props = withDefaults(defineProps<PoolLaunchProps>(), { configLocked: false })
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
  busy,
  error,
  loadRejection,
  signature,
  prepareAllowed,
  prepare,
  signAndSend,
} = usePoolLaunch({ network, connected, mainnetAcknowledged }, initialConfigAddress, {
  metadata: props.initialMetadata,
  firstBuy: props.initialFirstBuy,
})

watch(busy, (value) => emit('busy', value))

/** A first buy paying an anti-sniper fee is almost always a mistake worth stating. */
const highFee = computed(() => (prepared.value?.summary.firstBuy?.baseFeeBps ?? 0) >= HIGH_FIRST_BUY_FEE_BPS)

</script>

<style lang="scss">
@use '../../styles/mixins';

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
  @include mixins.control;
}

.pool-launch__button {
  align-self: flex-start;
  @include mixins.clickable;
}

.pool-launch__button--primary:enabled {
  border-color: var(--color-gain);
}

.pool-launch__summary {
  @include mixins.term-list;
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
