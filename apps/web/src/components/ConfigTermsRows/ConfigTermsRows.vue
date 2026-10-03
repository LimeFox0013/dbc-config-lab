<template>
  <dt>{{ t('components.deployPanel.summary.threshold') }}</dt>
  <dd class="config-terms__value">
    {{
      t('components.deployPanel.summary.thresholdValue', {
        amount: terms.migrationThreshold,
        symbol: QUOTE_TOKENS[terms.quoteToken].symbol,
      })
    }}
  </dd>
  <dt>{{ t('components.deployPanel.summary.keepers') }}</dt>
  <dd
    class="config-terms__value"
    :class="{ 'config-terms__value--warning': !terms.keepersMigrate }"
  >
    {{
      terms.keepersMigrate ?
        t('components.deployPanel.summary.keepersYes') :
        t('components.deployPanel.summary.keepersNo', {
          minimum: QUOTE_TOKENS[terms.quoteToken].keeperMinimumThreshold,
          symbol: QUOTE_TOKENS[terms.quoteToken].symbol,
        })
    }}
  </dd>
  <dt>{{ t('components.deployPanel.summary.dynamicFee') }}</dt>
  <dd class="config-terms__value">
    {{
      terms.dynamicFeeEnabled ?
        t('components.deployPanel.summary.dynamicFeeOn') :
        t('components.deployPanel.summary.dynamicFeeOff')
    }}
  </dd>
  <dt>{{ t('components.configEditor.fields.first-buy-min-fee') }}</dt>
  <dd class="config-terms__value">
    {{ t(`components.configEditor.options.firstBuyFee.${terms.firstBuyAtMinimumFee ? 1 : 0}`) }}
  </dd>
  <dt>{{ t('components.deployPanel.summary.creatorShare') }}</dt>
  <dd class="config-terms__value">
    {{ t('components.deployPanel.summary.percentValue', { value: terms.creatorTradingFeePercentage }) }}
  </dd>
  <dt>{{ t('components.deployPanel.summary.liquidity') }}</dt>
  <dd class="config-terms__value">
    {{
      t('components.deployPanel.summary.liquidityValue', {
        partner: terms.liquidity.partnerPercentage,
        partnerLocked: terms.liquidity.partnerLockedPercentage,
        creator: terms.liquidity.creatorPercentage,
        creatorLocked: terms.liquidity.creatorLockedPercentage,
      })
    }}
  </dd>
  <dt>{{ t('components.deployPanel.summary.lockedVesting') }}</dt>
  <dd class="config-terms__value">
    {{ t('components.deployPanel.summary.lockedVestingValue', { tokens: terms.lockedVestingTokens }) }}
  </dd>
  <dt>{{ t('components.deployPanel.summary.migrationPoolFee') }}</dt>
  <dd class="config-terms__value">
    {{ t(`components.configEditor.options.migratedPoolFeeOption.${terms.migrationFeeOption}`) }}
  </dd>
  <dt>{{ t('components.deployPanel.summary.migrationFee') }}</dt>
  <dd class="config-terms__value">
    {{
      t('components.deployPanel.summary.migrationFeeValue', {
        fee: terms.migrationFeePercentage,
        creator: terms.migrationCreatorFeePercentage,
      })
    }}
  </dd>
  <dt>{{ t('components.deployPanel.summary.poolCreationFee') }}</dt>
  <dd class="config-terms__value">
    {{ t('components.deployPanel.summary.poolCreationFeeValue', { sol: terms.poolCreationFeeSol }) }}
  </dd>
  <dt>{{ t('components.deployPanel.summary.tokenAuthority') }}</dt>
  <dd class="config-terms__value">
    {{ t(`components.deployPanel.summary.tokenAuthorityOptions.${terms.tokenAuthority}`) }}
  </dd>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { QUOTE_TOKENS } from '../../core/quote-token'
import type { ConfigTermsRowsProps } from './types'

defineProps<ConfigTermsRowsProps>()
const { t } = useI18n()
</script>

<style lang="scss">
.config-terms__value {
  margin: 0;
  font-family: var(--font-family-mono);
  overflow-wrap: anywhere;
}

.config-terms__value--warning {
  color: var(--color-loss);
}
</style>
