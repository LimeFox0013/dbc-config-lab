<template>
  <section class="account-plan">
    <h2 class="account-plan__title">
      {{ t('components.accountPlan.title') }}
    </h2>
    <dl class="account-plan__terms">
      <dt>{{ t('components.accountPlan.plan') }}</dt>
      <dd class="account-plan__plan">
        {{ t(`components.accountPlan.plans.${account.plan}`) }}
      </dd>
      <template v-if="account.planEndsAt && account.plan === PlanId.Pro">
        <dt>{{ t('components.accountPlan.endsAt') }}</dt>
        <dd class="account-plan__value">
          {{ formatUtcTime(account.planEndsAt) }}
        </dd>
      </template>
      <dt>{{ t('components.accountPlan.callsToday') }}</dt>
      <dd class="account-plan__value">
        {{ t('components.accountPlan.callsValue', { used: formatCount(account.callsToday), limit: formatCount(account.dailyCalls) }) }}
      </dd>
      <dt>{{ t('components.accountPlan.watches') }}</dt>
      <dd class="account-plan__value">
        {{ formatCount(account.watches) }}
      </dd>
    </dl>

    <button
      type="button"
      class="account-plan__button"
      :disabled="requesting || busy || confirmation === PaymentConfirmation.Waiting"
      @click="request"
    >
      {{ account.plan === PlanId.Pro ? t('components.accountPlan.extend') : t('components.accountPlan.upgrade') }}
    </button>
    <p
      v-if="requesting"
      class="account-plan__hint"
    >
      {{ t('components.accountPlan.requesting') }}
    </p>
    <RefusalNotice :failure="failure" />

    <template v-if="payment">
      <dl class="account-plan__terms account-plan__payment">
        <dt>{{ t('components.accountPlan.amount') }}</dt>
        <dd class="account-plan__value">
          {{ t('components.accountPlan.amountValue', { amount: payment.amountUsdc }) }}
        </dd>
        <dt>{{ t('components.accountPlan.recipient') }}</dt>
        <dd class="account-plan__value">
          {{ payment.recipient }}
        </dd>
        <dt>{{ t('components.accountPlan.network') }}</dt>
        <dd class="account-plan__value">
          {{ payment.network }}
        </dd>
        <dt>{{ t('components.accountPlan.reference') }}</dt>
        <dd class="account-plan__value">
          {{ payment.reference }}
        </dd>
      </dl>

      <template v-if="confirmation === PaymentConfirmation.Idle">
        <label
          v-if="payment.network === SolanaNetwork.Mainnet"
          class="account-plan__acknowledge"
        >
          <input
            v-model="mainnetAcknowledged"
            type="checkbox"
            :disabled="busy"
          />
          {{ t('components.accountPlan.acknowledge') }}
        </label>
        <WalletPicker
          :wallets="wallets"
          :connected="connected"
          :disabled="busy"
          :no-wallet-text="t('components.accountPlan.noWallet')"
          @connect="emit('connect', $event)"
        />
        <button
          v-if="step === DeployStep.Idle || step === DeployStep.Failed"
          type="button"
          class="account-plan__button"
          :disabled="!canSign"
          @click="prepare"
        >
          {{ t('components.accountPlan.prepare') }}
        </button>
        <p
          v-else-if="step === DeployStep.Preparing"
          class="account-plan__hint"
        >
          {{ t('common.signing.preparing') }}
        </p>
        <button
          v-else-if="step === DeployStep.Ready || step === DeployStep.Signing"
          type="button"
          class="account-plan__button account-plan__button--primary"
          :disabled="step === DeployStep.Signing"
          @click="pay"
        >
          {{ step === DeployStep.Signing ? t('common.signing.signing') : t('common.signing.sign') }}
        </button>
      </template>
      <p
        v-else-if="confirmation === PaymentConfirmation.Waiting"
        class="account-plan__hint"
        role="status"
      >
        {{ t('components.accountPlan.waiting') }}
      </p>
      <p
        v-else-if="confirmation === PaymentConfirmation.Credited"
        class="account-plan__done"
        role="status"
      >
        {{ t('components.accountPlan.credited', { date: payment.planEndsAt ? formatUtcTime(payment.planEndsAt) : '' }) }}
      </p>
      <template v-else-if="confirmation === PaymentConfirmation.NotYet">
        <p
          class="account-plan__hint"
          role="status"
        >
          {{ t('components.accountPlan.notYet') }}
        </p>
        <button
          type="button"
          class="account-plan__button"
          @click="confirm"
        >
          {{ t('components.accountPlan.checkAgain') }}
        </button>
      </template>
      <a
        v-if="signature"
        :href="explorerTransactionUrl(signature, payment.network)"
        target="_blank"
        rel="noopener noreferrer"
        class="account-plan__link"
      >{{ t('common.signing.viewTransaction') }}</a>
      <p
        v-if="error"
        class="account-plan__error"
        role="alert"
      >
        {{ error }}
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { explorerTransactionUrl } from '@dbc-config-lab/core/core/config-deploy'
import { formatCount, SolanaNetwork } from '@dbc-config-lab/core/core/shared'
import {
  formatUtcTime,
  PaymentConfirmation,
  PlanId,
  usePlanPayment,
} from '@dbc-config-lab/core/features/account'
import { DeployStep } from '@dbc-config-lab/core/features/deployment'
import type { DeployWallet } from '@dbc-config-lab/core/features/wallet'
import { RefusalNotice } from '../RefusalNotice'
import { WalletPicker } from '../WalletPicker'
import type { AccountPlanProps } from './types'

/**
 * `service-plans` / `usdc-plan-payment`: the plan, today's usage, and paying for Pro from
 * the person's own wallet — shown as paid only once the service credits the transfer.
 */
const props = defineProps<AccountPlanProps>()
const emit = defineEmits<{ connect: [wallet: DeployWallet], credited: [] }>()
const { t } = useI18n()

const {
  payment,
  failure,
  requesting,
  confirmation,
  mainnetAcknowledged,
  step,
  error,
  signature,
  busy,
  canSign,
  request,
  prepare,
  pay,
  confirm,
} = usePlanPayment({
  client: props.client,
  connected: toRef(props, 'connected'),
  onCredited: () => emit('credited'),
})
</script>

<style lang="scss">
@use '../../styles/mixins';

.account-plan {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  @include mixins.surface;
}

.account-plan__title {
  margin: 0;
  font-size: var(--font-size-3);
}

.account-plan__terms {
  @include mixins.term-list;
}

.account-plan__plan {
  font-weight: var(--font-weight-strong);
}

.account-plan__value {
  font-family: var(--font-family-mono);
}

.account-plan__hint {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.account-plan__done {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-gain);
}

.account-plan__error {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-loss);
}

.account-plan__acknowledge {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  color: var(--color-loss);
  font-size: var(--font-size-2);
}

.account-plan__button {
  align-self: flex-start;
  @include mixins.control;
  @include mixins.clickable;
}

.account-plan__button--primary:enabled {
  border-color: var(--color-gain);
}

.account-plan__link {
  color: var(--color-gain);
  font-size: var(--font-size-2);
}
</style>
