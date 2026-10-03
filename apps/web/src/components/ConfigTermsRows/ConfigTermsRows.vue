<template>
  <dt>{{ t('components.configTermsRows.threshold') }}</dt>
  <dd class="config-terms__value">
    {{
      t('components.configTermsRows.thresholdValue', {
        amount: terms.migrationThreshold,
        symbol: QUOTE_TOKENS[terms.quoteToken].symbol,
      })
    }}
  </dd>
  <dt>{{ t('components.configTermsRows.keepers') }}</dt>
  <dd
    class="config-terms__value"
    :class="{ 'config-terms__value--warning': !terms.keepersMigrate }"
  >
    {{
      terms.keepersMigrate ?
        t('components.configTermsRows.keepersYes') :
        t('components.configTermsRows.keepersNo', {
          minimum: QUOTE_TOKENS[terms.quoteToken].keeperMinimumThreshold,
          symbol: QUOTE_TOKENS[terms.quoteToken].symbol,
        })
    }}
  </dd>
  <dt>{{ t('components.configTermsRows.dynamicFee') }}</dt>
  <dd class="config-terms__value">
    {{
      terms.dynamicFeeEnabled ?
        t('components.configTermsRows.dynamicFeeOn') :
        t('components.configTermsRows.dynamicFeeOff')
    }}
  </dd>
  <dt>{{ t('components.configTermsRows.firstBuy') }}</dt>
  <dd class="config-terms__value">
    {{ t(`common.configOptions.firstBuyFee.${terms.firstBuyAtMinimumFee ? 1 : 0}`) }}
  </dd>
  <dt>{{ t('components.configTermsRows.creatorShare') }}</dt>
  <dd class="config-terms__value">
    {{ t('components.configTermsRows.percentValue', { value: terms.creatorTradingFeePercentage }) }}
  </dd>
  <dt>{{ t('components.configTermsRows.feesCollectedIn') }}</dt>
  <dd class="config-terms__value">
    {{ t(`components.configTermsRows.feesCollectedInOptions.${terms.feesCollectedIn}`) }}
  </dd>
  <dt>{{ t('components.configTermsRows.liquidity') }}</dt>
  <dd class="config-terms__value">
    {{
      t('components.configTermsRows.liquidityValue', {
        partner: terms.liquidity.partnerPercentage,
        partnerLocked: terms.liquidity.partnerLockedPercentage,
        partnerVesting: terms.partnerLiquidityVesting?.percentage ?? 0,
        creator: terms.liquidity.creatorPercentage,
        creatorLocked: terms.liquidity.creatorLockedPercentage,
        creatorVesting: terms.creatorLiquidityVesting?.percentage ?? 0,
      })
    }}
  </dd>
  <template
    v-for="vesting in liquidityVestings"
    :key="vesting.who"
  >
    <dt>{{ t(`components.configTermsRows.liquidityVesting.${vesting.who}`) }}</dt>
    <dd class="config-terms__value">
      {{
        t('components.configTermsRows.liquidityVestingValue', {
          percentage: vesting.schedule.percentage,
          cliff: duration(vesting.schedule.cliffSeconds),
          periods: vesting.schedule.periods,
          period: duration(vesting.schedule.periodSeconds),
        })
      }}
    </dd>
  </template>
  <dt>{{ t('components.configTermsRows.lockedVesting') }}</dt>
  <dd class="config-terms__value">
    {{
      terms.lockedVesting.totalTokens === 0 ?
        t('components.configTermsRows.lockedVestingNone') :
        t('components.configTermsRows.lockedVestingValue', {
          total: formatAmount(terms.lockedVesting.totalTokens),
          cliffTokens: formatAmount(terms.lockedVesting.cliffTokens),
          cliff: duration(terms.lockedVesting.cliffSeconds),
          perPeriod: formatAmount(terms.lockedVesting.tokensPerPeriod),
          periods: terms.lockedVesting.periods,
          period: duration(terms.lockedVesting.periodSeconds),
        })
    }}
  </dd>
  <dt>{{ t('components.configTermsRows.migrationPoolFee') }}</dt>
  <dd class="config-terms__value">
    {{
      terms.migrationPoolFeeBps === null ?
        t(`common.configOptions.migratedPoolFeeOption.${terms.migrationFeeOption}`) :
        t('components.configTermsRows.percentValue', { value: percentFromBps(terms.migrationPoolFeeBps) })
    }}
  </dd>
  <dt>{{ t('components.configTermsRows.graduatedFeesCollectedIn') }}</dt>
  <dd class="config-terms__value">
    {{
      t(`components.configTermsRows.graduatedFeesCollectedInOptions.${terms.graduatedFeesCollectedIn}`, {
        compounding: percentFromBps(terms.compoundingFeeBps),
      })
    }}
  </dd>
  <dt>{{ t('components.configTermsRows.migrationFee') }}</dt>
  <dd class="config-terms__value">
    {{
      t('components.configTermsRows.migrationFeeValue', {
        fee: terms.migrationFeePercentage,
        creator: terms.migrationCreatorFeePercentage,
      })
    }}
  </dd>
  <dt>{{ t('components.configTermsRows.poolCreationFee') }}</dt>
  <dd class="config-terms__value">
    {{ t('components.configTermsRows.poolCreationFeeValue', { sol: terms.poolCreationFeeSol }) }}
  </dd>
  <dt>{{ t('components.configTermsRows.supply') }}</dt>
  <dd class="config-terms__value">
    {{
      terms.fixedSupply ?
        t('components.configTermsRows.supplyFixed', {
          before: formatAmount(terms.fixedSupply.preMigration),
          after: formatAmount(terms.fixedSupply.postMigration),
        }) :
        t('components.configTermsRows.supplyNotFixed')
    }}
  </dd>
  <dt>{{ t('components.configTermsRows.tokenType') }}</dt>
  <dd class="config-terms__value">
    {{ t(`components.configTermsRows.tokenTypeOptions.${terms.tokenType}`) }}
  </dd>
  <dt>{{ t('components.configTermsRows.tokenAuthority') }}</dt>
  <dd class="config-terms__value">
    {{ t(`components.configTermsRows.tokenAuthorityOptions.${terms.tokenAuthority}`) }}
  </dd>
</template>

<script setup lang="ts">
import { LiquidityHolder } from './constants'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { QUOTE_TOKENS } from '../../core/quote-token'
import { formatAmount, percentFromBps } from '../../core/shared'
import type { ConfigTermsRowsProps } from './types'
import { durationParts } from './utils'

const props = defineProps<ConfigTermsRowsProps>()
const { t } = useI18n()

const duration = (seconds: number): string => {
  const { value, unit } = durationParts(seconds)
  return t(`components.configTermsRows.duration.${unit}`, { value })
}
/** Graduation liquidity that unlocks over time, for whoever has some. */
const liquidityVestings = computed(() =>
  [
    { who: LiquidityHolder.Partner, schedule: props.terms.partnerLiquidityVesting },
    { who: LiquidityHolder.Creator, schedule: props.terms.creatorLiquidityVesting },
  ].flatMap(({ who, schedule }) => (schedule ? [{ who, schedule }] : [])),
)
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
