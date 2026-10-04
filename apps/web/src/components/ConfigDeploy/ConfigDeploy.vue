<template>
  <div class="config-deploy">
    <button
      v-if="step !== DeployStep.Ready && step !== DeployStep.Signing && step !== DeployStep.Done"
      type="button"
      class="config-deploy__button config-deploy__button--primary"
      :disabled="!prepareAllowed || step === DeployStep.Preparing"
      @click="prepare"
    >
      {{ step === DeployStep.Preparing ? t('common.signing.preparing') : t('components.deployPanel.prepare') }}
    </button>

    <dl
      v-if="prepared && step !== DeployStep.Done"
      class="config-deploy__summary"
    >
      <dt>{{ t('components.deployPanel.summary.network') }}</dt>
      <dd class="config-deploy__value config-deploy__value--network">
        {{ prepared.summary.network }}
      </dd>
      <dt>{{ t('components.deployPanel.summary.configAddress') }}</dt>
      <dd class="config-deploy__value">
        {{ prepared.summary.configAddress }}
      </dd>
      <dt>{{ t('components.deployPanel.summary.payer') }}</dt>
      <dd class="config-deploy__value">
        {{ prepared.summary.payer }}
      </dd>
      <dt>{{ t('components.deployPanel.summary.feeClaimer') }}</dt>
      <dd class="config-deploy__value">
        {{ prepared.summary.feeClaimer }}
      </dd>
      <template v-if="prepared.summary.royalty">
        <dt>{{ t('components.deployPanel.summary.royalty') }}</dt>
        <dd class="config-deploy__value">
          {{
            t('components.deployPanel.summary.royaltyValue', {
              you: prepared.summary.royalty.deployerPercent,
              author: prepared.summary.royalty.authorPercent,
              address: prepared.summary.royalty.author,
            })
          }}
        </dd>
        <dt>{{ t('components.deployPanel.summary.royaltyLiquidity') }}</dt>
        <dd class="config-deploy__value config-deploy__value--warning">
          {{ t('components.deployPanel.summary.royaltyLiquidityValue') }}
        </dd>
      </template>
      <dt>{{ t('components.deployPanel.summary.leftoverReceiver') }}</dt>
      <dd class="config-deploy__value">
        {{ prepared.summary.leftoverReceiver }}
      </dd>
      <dt>{{ t('components.deployPanel.summary.quoteMint') }}</dt>
      <dd class="config-deploy__value">
        {{
          t('components.deployPanel.summary.quoteMintValue', {
            symbol: QUOTE_TOKENS[prepared.summary.quoteToken].symbol,
            mint: prepared.summary.quoteMint,
          })
        }}
      </dd>
      <dt>{{ t('components.deployPanel.summary.fee') }}</dt>
      <dd class="config-deploy__value">
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
      class="config-deploy__button config-deploy__button--primary"
      :disabled="step === DeployStep.Signing"
      @click="signAndSend"
    >
      {{ step === DeployStep.Signing ? t('common.signing.signing') : t('common.signing.sign') }}
    </button>

    <p
      v-if="step === DeployStep.Done && signature && prepared"
      class="config-deploy__done"
    >
      {{ t('components.deployPanel.done') }}
      <a
        :href="explorerAddressUrl(prepared.summary.configAddress, network)"
        target="_blank"
        rel="noopener noreferrer"
        class="config-deploy__link"
      >{{ t('components.deployPanel.viewConfig') }}</a>
      <a
        :href="explorerTransactionUrl(signature, network)"
        target="_blank"
        rel="noopener noreferrer"
        class="config-deploy__link"
      >{{ t('common.signing.viewTransaction') }}</a>
    </p>

    <p
      v-if="error"
      class="config-deploy__error"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { toRefs, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { explorerAddressUrl, explorerTransactionUrl } from '../../core/config-deploy'
import { QUOTE_TOKENS } from '../../core/quote-token'
import { DeployStep, useDeployment } from '../../features/deployment'
import { useFeeScheduleText } from '../../features/fee-text'
import { ConfigTermsRows } from '../ConfigTermsRows'
import type { ConfigDeployProps } from './types'

const props = defineProps<ConfigDeployProps>()
/** The surrounding network and wallet must not change while the deploy is prepared or signed. */
const emit = defineEmits<{ busy: [busy: boolean], deployed: [configAddress: string] }>()
const { t } = useI18n()
const feeScheduleText = useFeeScheduleText()
const { target, network, connected, mainnetAcknowledged } = toRefs(props)

const { busy, prepared, step, error, signature, prepareAllowed, prepare, signAndSend } = useDeployment(target, {
  network,
  connected,
  mainnetAcknowledged,
})

watch(busy, (value) => emit('busy', value))
watch(step, (current) => {
  if (current === DeployStep.Done && prepared.value) emit('deployed', prepared.value.summary.configAddress)
})
</script>

<style lang="scss">
@use '../../styles/mixins';

.config-deploy {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.config-deploy__button {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  align-self: flex-start;
  @include mixins.control;
  @include mixins.clickable;
}

.config-deploy__button--primary:enabled {
  border-color: var(--color-gain);
}

.config-deploy__summary {
  @include mixins.term-list;
}

.config-deploy__value {
  font-family: var(--font-family-mono);
  overflow-wrap: anywhere;
}

.config-deploy__value--network {
  color: var(--color-loss);
  font-weight: var(--font-weight-strong);
}

.config-deploy__value--warning {
  color: var(--color-loss);
}

.config-deploy__done {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin: 0;
}

.config-deploy__link {
  color: var(--color-gain);
}

.config-deploy__error {
  margin: 0;
  color: var(--color-loss);
  font-size: var(--font-size-2);
  overflow-wrap: anywhere;
}
</style>
