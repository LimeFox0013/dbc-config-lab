<template>
  <section class="earnings-section">
    <h3 class="earnings-section__title">
      {{ t('components.deployPanel.earnings.title') }}
    </h3>
    <p class="earnings-section__hint">
      {{ t('components.deployPanel.earnings.intro') }}
    </p>
    <button
      type="button"
      class="earnings-section__button"
      :disabled="!connected || finding || busy"
      @click="find"
    >
      {{ finding ? t('components.deployPanel.earnings.finding') : t('components.deployPanel.earnings.find') }}
    </button>

    <p
      v-if="result && !result.ok"
      class="earnings-section__error"
      role="alert"
    >
      {{ t('components.deployPanel.earnings.failed', { detail: result.detail ?? '' }) }}
    </p>
    <template v-else-if="result && result.ok">
      <p
        v-if="result.earnings.rows.length === 0"
        class="earnings-section__hint"
      >
        {{ t('components.deployPanel.earnings.none') }}
      </p>
      <p
        v-else-if="result.earnings.totalRows > result.earnings.rows.length"
        class="earnings-section__hint"
      >
        {{ t('components.deployPanel.earnings.limited', { shown: result.earnings.rows.length, total: result.earnings.totalRows }) }}
      </p>
      <ul
        v-if="result.earnings.rows.length > 0"
        class="earnings-section__list"
      >
        <li
          v-for="row in result.earnings.rows"
          :key="`${row.pool}:${row.role}`"
          class="earnings-section__row"
        >
          <span class="earnings-section__pool">
            <a
              :href="explorerAddressUrl(row.pool, network)"
              target="_blank"
              rel="noopener noreferrer"
              class="earnings-section__link"
            >{{ shortAddress(row.pool) }}</a>
            · {{ t(`components.deployPanel.earnings.roles.${row.role}`) }}
          </span>
          <span class="earnings-section__amount">{{ amountText(row) }}</span>
          <button
            type="button"
            class="earnings-section__button"
            :disabled="busy"
            @click="prepareClaim(row)"
          >
            {{ t('components.deployPanel.earnings.claim') }}
          </button>
        </li>
      </ul>
    </template>

    <p
      v-if="claiming && step === DeployStep.Preparing"
      class="earnings-section__hint"
    >
      {{ t('common.signing.preparing') }}
    </p>
    <dl
      v-if="claiming && prepared && step !== DeployStep.Done"
      class="earnings-section__summary"
    >
      <dt>{{ t('components.deployPanel.summary.network') }}</dt>
      <dd class="earnings-section__value earnings-section__value--network">
        {{ prepared.summary.network }}
      </dd>
      <dt>{{ t('components.deployPanel.earnings.pool') }}</dt>
      <dd class="earnings-section__value">
        {{ prepared.summary.pool }}
      </dd>
      <dt>{{ t('components.deployPanel.earnings.as') }}</dt>
      <dd class="earnings-section__value">
        {{ t(`components.deployPanel.earnings.roles.${prepared.summary.role}`) }}
      </dd>
      <dt>{{ t('components.deployPanel.earnings.receive') }}</dt>
      <dd class="earnings-section__value">
        {{ amountText(claiming) }}
      </dd>
      <dt>{{ t('components.deployPanel.earnings.receiver') }}</dt>
      <dd class="earnings-section__value">
        {{ prepared.summary.receiver }}
      </dd>
    </dl>
    <button
      v-if="step === DeployStep.Ready || step === DeployStep.Signing"
      type="button"
      class="earnings-section__button earnings-section__button--primary"
      :disabled="step === DeployStep.Signing"
      @click="signAndSend"
    >
      {{ step === DeployStep.Signing ? t('common.signing.signing') : t('common.signing.sign') }}
    </button>
    <p
      v-if="step === DeployStep.Done && signature"
      class="earnings-section__done"
    >
      {{ t('components.deployPanel.earnings.claimed') }}
      <a
        :href="explorerTransactionUrl(signature, network)"
        target="_blank"
        rel="noopener noreferrer"
        class="earnings-section__link"
      >{{ t('common.signing.viewTransaction') }}</a>
    </p>
    <p
      v-if="error"
      class="earnings-section__error"
      role="alert"
    >
      {{ error }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { toRefs, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { explorerAddressUrl, explorerTransactionUrl } from '../../core/config-deploy'
import { QUOTE_TOKENS, wholeQuoteTokens } from '../../core/quote-token'
import { formatSol, shortAddress } from '../../core/shared'
import { DeployStep } from '../../features/deployment'
import { useEarnings } from '../../features/earnings'
import type { EarningsRow } from '../../features/earnings'
import type { EarningsSectionProps } from './types'

const props = defineProps<EarningsSectionProps>()
/** The panel's network and wallet must not change while a claim is prepared or signed. */
const emit = defineEmits<{ busy: [busy: boolean] }>()
const { t } = useI18n()
const { network, connected, mainnetAcknowledged } = toRefs(props)

const { result, finding, claiming, prepared, step, busy, error, signature, find, prepareClaim, signAndSend } =
  useEarnings({ network, connected, mainnetAcknowledged })

watch(busy, (value) => emit('busy', value))

/** The quote amount in its token, base-token fees as raw units, and the SOL value when priced. */
const amountText = (row: EarningsRow): string => {
  const quote = row.quoteToken ?
      t('components.deployPanel.earnings.quoteAmount', {
        amount: wholeQuoteTokens(row.unclaimedQuote, row.quoteToken),
        symbol: QUOTE_TOKENS[row.quoteToken].symbol,
      }) :
      t('components.deployPanel.earnings.rawAmount', { amount: row.unclaimedQuote.toString(), mint: shortAddress(row.quoteMint) })
  const base = row.unclaimedBase.isZero() ?
    '' :
      t('components.deployPanel.earnings.baseAmount', { amount: row.unclaimedBase.toString() })
  const value = row.valueSol === null ? '' : t('components.deployPanel.earnings.value', { sol: formatSol(row.valueSol) })
  return `${quote}${base}${value}`
}
</script>

<style lang="scss">
@use '../../styles/mixins';

.earnings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: var(--border-width-1) solid var(--color-border);
}

.earnings-section__title {
  margin: 0;
  font-size: var(--font-size-3);
}

.earnings-section__hint {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.earnings-section__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.earnings-section__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  font-size: var(--font-size-2);
}

.earnings-section__amount,
.earnings-section__value {
  font-family: var(--font-family-mono);
  overflow-wrap: anywhere;
}

.earnings-section__button {
  align-self: flex-start;
  @include mixins.control;
  @include mixins.clickable;
}

.earnings-section__button--primary:enabled {
  border-color: var(--color-gain);
}

.earnings-section__summary {
  @include mixins.term-list;
}

.earnings-section__value--network {
  color: var(--color-loss);
}

.earnings-section__done {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin: 0;
}

.earnings-section__link {
  color: var(--color-gain);
}

.earnings-section__error {
  margin: 0;
  color: var(--color-loss);
  font-size: var(--font-size-2);
  overflow-wrap: anywhere;
}
</style>
