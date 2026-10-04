<template>
  <main class="report-view">
    <p
      v-if="state.status === LaunchPageStatus.Loading"
      class="report-view__hint"
    >
      {{ t('views.report.loading') }}
    </p>

    <section
      v-else-if="state.status === LaunchPageStatus.Refused"
      class="report-view__section"
    >
      <h1 class="report-view__title">
        {{ t('views.report.refusedTitle') }}
      </h1>
      <p
        class="report-view__error"
        role="alert"
      >
        {{ t(`common.loadRejections.${state.rejection}`, { detail: state.detail ?? '' }) }}
      </p>
    </section>

    <template v-else-if="report">
      <p class="report-view__eyebrow">
        {{ t('views.report.eyebrow') }}
      </p>
      <LaunchpadIdentity
        :config="state.config"
        :branding="state.branding"
        :royalty="state.royalty"
      />
      <p class="report-view__hint">
        {{ t('views.report.intro') }}
      </p>
      <div class="report-view__actions">
        <button
          type="button"
          class="report-view__button"
          @click="download"
        >
          {{ t('views.report.download') }}
        </button>
        <RouterLink
          :to="launchPagePath(report.configAddress, report.network)"
          class="report-view__link"
        >
          {{ t('views.report.launchLink') }}
        </RouterLink>
      </div>

      <section class="report-view__section">
        <h2 class="report-view__heading">
          {{ t('views.report.risksTitle') }}
        </h2>
        <ul
          v-if="report.risks.length > 0"
          class="report-view__risks"
        >
          <li
            v-for="finding in report.risks"
            :key="finding.risk"
            class="report-view__risk"
          >
            {{ riskText(finding) }}
          </li>
        </ul>
        <p
          v-else
          class="report-view__hint"
        >
          {{ t('views.report.risksNone') }}
        </p>
      </section>

      <section class="report-view__section">
        <h2 class="report-view__heading">
          {{ t('views.report.termsTitle') }}
        </h2>
        <dl class="report-view__terms">
          <template v-if="schedule">
            <dt>{{ t('views.report.fee') }}</dt>
            <dd class="report-view__value">
              {{ feeScheduleText(schedule) }}
            </dd>
          </template>
          <ConfigTermsRows :terms="report.terms" />
        </dl>
      </section>

      <section class="report-view__section">
        <p class="report-view__label">
          {{ t('views.report.realLabel') }}
        </p>
        <RealLaunchesSummary
          v-if="real"
          :state="real"
        />
      </section>

      <section class="report-view__section">
        <h2 class="report-view__heading">
          {{ t('views.report.simulatedTitle') }}
        </h2>
        <p class="report-view__hint">
          {{ t('views.report.simulatedIntro') }}
        </p>
        <ComparisonTable :rows="typicalRows" />
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { ComparisonTable } from '../components/ComparisonTable'
import { ConfigTermsRows } from '../components/ConfigTermsRows'
import { LaunchpadIdentity } from '../components/LaunchpadIdentity'
import { RealLaunchesSummary } from '../components/RealLaunchesSummary'
import { connectionFor } from '../core/config-deploy'
import { feeScheduleOf } from '../core/launch-simulator'
import {
  configReport,
  reportFileName,
  ReportRisk,
  simulationOf,
  typicalLaunchRow,
} from '../features/config-report'
import type { ReportFinding } from '../features/config-report'
import { useFeeScheduleText } from '../features/fee-text'
import {
  LaunchPageStatus,
  launchPagePath,
  networkFromQuery,
  useLaunchPage,
} from '../features/launch-page'
import { fetchRealLaunches } from '../features/real-launches'
import type { RealLaunchesState } from '../features/real-launches'
import { NETWORK_QUERY_KEY } from '../router'

const { t } = useI18n()
const feeScheduleText = useFeeScheduleText()
const route = useRoute()
const network = computed(() => networkFromQuery(route.query[NETWORK_QUERY_KEY]))
const address = computed(() => String(route.params.config ?? ''))
const { state } = useLaunchPage(network, address)

const ready = computed(() => (state.value.status === LaunchPageStatus.Ready ? state.value : null))

const schedule = computed(() => (ready.value ? feeScheduleOf(ready.value.config.parameters) : null))

/** The real launches on the loaded config, read once it has loaded. */
const real = shallowRef<RealLaunchesState | null>(null)
watch(ready, async (current) => {
  real.value = current ? { loading: true } : null
  if (!current) return
  const { config } = current
  const result = await fetchRealLaunches(connectionFor(config.network), config.configAddress, config.parameters, config.quoteToken)
  if (ready.value === current) real.value = { loading: false, result }
}, { immediate: true })

const typicalRow = computed(() =>
  ready.value ? typicalLaunchRow(ready.value.config, t('views.report.simulatedName')) : null,
)
const typicalRows = computed(() => (typicalRow.value ? [typicalRow.value] : []))
const report = computed(() =>
  ready.value && typicalRow.value ?
      configReport(ready.value.config, {
        branding: ready.value.branding,
        royalty: ready.value.royalty,
        real: real.value && !real.value.loading ? real.value.result : null,
        simulated: simulationOf(typicalRow.value),
      }) :
    null,
)

const holder = (finding: { holder: string }): string => t(`views.report.holders.${finding.holder}`)
const riskText = (finding: ReportFinding): string => {
  switch (finding.risk) {
    case ReportRisk.LiquidityPullable:
      return t(`views.report.risks.${finding.risk}`, {
        total: finding.partnerPercent + finding.creatorPercent,
        partner: finding.partnerPercent,
        creator: finding.creatorPercent,
      })
    case ReportRisk.MintAuthorityKept:
    case ReportRisk.MetadataMutable:
      return t(`views.report.risks.${finding.risk}`, { holder: holder(finding) })
    case ReportRisk.NoAutoGraduation:
      return t(`views.report.risks.${finding.risk}`)
    case ReportRisk.RefusedToday:
      return t(`views.report.risks.${finding.risk}`, { reason: finding.reason })
  }
}

/** Saves the report exactly as shown, as JSON. */
const download = (): void => {
  if (!report.value) return
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(report.value, null, 2)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = reportFileName(report.value)
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<style lang="scss">
@use '../styles/mixins';

.report-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

.report-view__eyebrow,
.report-view__label {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.report-view__title {
  margin: 0;
  font-size: var(--font-size-5);
  overflow-wrap: anywhere;
}

.report-view__heading {
  margin: 0;
  font-size: var(--font-size-3);
}

.report-view__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  @include mixins.surface;
}

.report-view__hint {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.report-view__error {
  margin: 0;
  color: var(--color-loss);
  font-size: var(--font-size-2);
  overflow-wrap: anywhere;
}

.report-view__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: center;
}

.report-view__button {
  @include mixins.control;
  @include mixins.clickable;
}

.report-view__link {
  color: var(--color-gain);
  font-size: var(--font-size-2);
}

.report-view__risks {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding-left: var(--space-4);
  font-size: var(--font-size-2);
}

.report-view__risk {
  overflow-wrap: anywhere;
}

.report-view__terms {
  @include mixins.term-list;
}

.report-view__value {
  font-family: var(--font-family-mono);
}
</style>
