<template>
  <details class="operator-dashboard">
    <summary class="operator-dashboard__summary">
      {{ t('components.operatorDashboard.title') }}
    </summary>
    <p class="operator-dashboard__hint">
      {{ t('components.operatorDashboard.intro') }}
    </p>
    <form
      class="operator-dashboard__controls"
      @submit.prevent="lookUp"
    >
      <label class="operator-dashboard__field">
        <span class="operator-dashboard__label">{{ t('components.operatorDashboard.network') }}</span>
        <select
          v-model="network"
          class="operator-dashboard__control"
        >
          <option :value="SolanaNetwork.Mainnet">
            {{ t('components.operatorDashboard.mainnet') }}
          </option>
          <option :value="SolanaNetwork.Devnet">
            {{ t('components.operatorDashboard.devnet') }}
          </option>
        </select>
      </label>
      <label class="operator-dashboard__field operator-dashboard__field--wide">
        <span class="operator-dashboard__label">{{ t('components.operatorDashboard.address') }}</span>
        <input
          v-model.trim="address"
          class="operator-dashboard__control"
          type="text"
          spellcheck="false"
          autocomplete="off"
          :maxlength="MAX_ADDRESS_LENGTH"
        />
      </label>
      <button
        type="submit"
        class="operator-dashboard__control operator-dashboard__button"
        :disabled="address.length === 0"
      >
        {{ t('components.operatorDashboard.watch') }}
      </button>
    </form>
    <p
      v-if="reading && !report"
      class="operator-dashboard__hint"
      role="status"
    >
      {{ t('components.operatorDashboard.reading') }}
    </p>
    <p
      v-if="problem"
      class="operator-dashboard__hint operator-dashboard__problem"
      role="status"
    >
      {{ t(`components.operatorDashboard.rejections.${problem.rejection}`, { detail: problem.detail ?? '' }) }}
    </p>
    <template v-if="report && totals">
      <p
        class="operator-dashboard__hint"
        aria-live="polite"
      >
        {{ t('components.operatorDashboard.readAt', { time: readTime(report.readAt) }) }}
      </p>
      <dl class="operator-dashboard__totals">
        <dt>{{ t('components.operatorDashboard.totals.launches') }}</dt>
        <dd>{{ t('components.operatorDashboard.totals.launchesValue', { launches: formatCount(totals.launches), graduated: formatCount(totals.graduated) }) }}</dd>
        <dt>{{ t('components.operatorDashboard.totals.curveFees') }}</dt>
        <dd>{{ t('components.operatorDashboard.sol', { sol: formatSol(totals.curveFeesSol) }) }}</dd>
        <dt>{{ t('components.operatorDashboard.totals.unclaimed') }}</dt>
        <dd>{{ t('components.operatorDashboard.sol', { sol: formatSol(totals.unclaimedSol) }) }}</dd>
        <dt>{{ t('components.operatorDashboard.totals.afterGraduation') }}</dt>
        <dd>
          {{
            report.positions.length === 0 ?
              t('components.operatorDashboard.noPositions') :
              t('components.operatorDashboard.sol', { sol: formatSol(totals.afterGraduationSol) })
          }}
        </dd>
      </dl>
      <p
        v-for="positions in report.positions"
        :key="positions.quoteToken"
        class="operator-dashboard__hint"
      >
        {{
          positions.held === 0 ?
            t('components.operatorDashboard.positionsNone', { symbol: QUOTE_TOKENS[positions.quoteToken].symbol }) :
          positions.read < positions.held ?
            t('components.operatorDashboard.positionsSampled', { read: formatCount(positions.read), held: formatCount(positions.held), symbol: QUOTE_TOKENS[positions.quoteToken].symbol }) :
            t('components.operatorDashboard.positionsAll', { held: formatCount(positions.held), symbol: QUOTE_TOKENS[positions.quoteToken].symbol })
        }}
      </p>
      <div class="operator-dashboard__scroll">
        <table class="operator-dashboard__table">
          <thead>
            <tr>
              <th scope="col">
                {{ t('components.operatorDashboard.columns.config') }}
              </th>
              <th
                scope="col"
                class="operator-dashboard__number"
              >
                {{ t('components.operatorDashboard.columns.launches') }}
              </th>
              <th
                scope="col"
                class="operator-dashboard__number"
              >
                {{ t('components.operatorDashboard.columns.graduated') }}
              </th>
              <th
                scope="col"
                class="operator-dashboard__number"
              >
                {{ t('components.operatorDashboard.columns.curveFees') }}
              </th>
              <th
                scope="col"
                class="operator-dashboard__number"
              >
                {{ t('components.operatorDashboard.columns.unclaimed') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in report.configs"
              :key="row.config"
            >
              <th scope="row">
                <a
                  :href="explorerAddressUrl(row.config, network)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="operator-dashboard__link"
                >{{ shortAddress(row.config) }}</a>
              </th>
              <td class="operator-dashboard__number">
                {{ formatCount(row.launches) }}
              </td>
              <td class="operator-dashboard__number">
                {{ formatCount(row.graduated) }}
              </td>
              <td class="operator-dashboard__number">
                {{ solOrUnpriced(row.curveFeesSol) }}
              </td>
              <td class="operator-dashboard__number">
                {{ solOrUnpriced(row.unclaimedSol) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </details>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { explorerAddressUrl } from '../../core/config-deploy'
import { QUOTE_TOKENS } from '../../core/quote-token'
import {
  formatCount,
  formatSol,
  shortAddress,
  SolanaNetwork,
} from '../../core/shared'
import { MAX_ADDRESS_LENGTH } from '../../features/onchain-config'
import {
  operatorTotals,
  useOperatorDashboard,
} from '../../features/operator-dashboard'

const { t } = useI18n()
const network = ref(SolanaNetwork.Mainnet)
const address = ref('')
const { report, problem, reading, watch } = useOperatorDashboard()

const totals = computed(() => (report.value ? operatorTotals(report.value) : null))

const readTime = (iso: string): string => new Date(iso).toLocaleTimeString()
const solOrUnpriced = (sol: number | null): string =>
  sol === null ?
      t('components.operatorDashboard.unpriced') :
      t('components.operatorDashboard.sol', { sol: formatSol(sol) })

const lookUp = (): void => {
  void watch(address.value, network.value)
}
</script>

<style lang="scss">
@use '../../styles/mixins';

.operator-dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  @include mixins.surface;
}

.operator-dashboard__summary {
  cursor: pointer;
  font-size: var(--font-size-3);
  font-weight: var(--font-weight-strong);
}

.operator-dashboard__hint {
  margin: var(--space-2) 0 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.operator-dashboard__problem {
  color: var(--color-loss);
}

.operator-dashboard__controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: flex-end;
  margin-top: var(--space-3);
}

.operator-dashboard__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.operator-dashboard__field--wide {
  flex: 1;
  min-width: 0;
}

.operator-dashboard__label {
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.operator-dashboard__control {
  @include mixins.control;
}

.operator-dashboard__button {
  @include mixins.clickable;
}

.operator-dashboard__totals {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-1) var(--space-3);
  margin: var(--space-3) 0 0;
  font-size: var(--font-size-2);

  dd {
    margin: 0;
    font-family: var(--font-family-mono);
  }
}

.operator-dashboard__scroll {
  overflow-x: auto;
}

.operator-dashboard__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-2);

  th,
  td {
    padding: var(--space-2);
    border-bottom: var(--border-width-1) solid var(--color-border);
    text-align: left;
  }
}

.operator-dashboard__table .operator-dashboard__number {
  text-align: right;
  white-space: nowrap;
}

.operator-dashboard__table td.operator-dashboard__number {
  font-family: var(--font-family-mono);
}

.operator-dashboard__link {
  color: var(--color-gain);
  font-family: var(--font-family-mono);
}
</style>
