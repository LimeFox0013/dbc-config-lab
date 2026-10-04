<template>
  <section class="recommender-panel">
    <h2 class="recommender-panel__title">
      {{ t('components.recommenderPanel.title') }}
    </h2>

    <div
      class="recommender-panel__goals"
      role="group"
      :aria-label="t('components.recommenderPanel.goal')"
    >
      <button
        v-for="goal in goals"
        :key="goal"
        type="button"
        class="recommender-panel__goal"
        :class="{ 'recommender-panel__goal--active': selectedGoal === goal }"
        @click="selectGoal(goal)"
      >
        {{ t(`components.recommenderPanel.goals.${goal}`) }}
      </button>
    </div>

    <details class="recommender-panel__advanced">
      <summary class="recommender-panel__advanced-toggle">
        {{ t('components.recommenderPanel.adjustWeights') }}
      </summary>
      <div class="recommender-panel__weights">
        <label
          v-for="weight in weightKeys"
          :key="weight"
          class="recommender-panel__weight"
        >
          <span class="recommender-panel__label">
            {{ t(`components.recommenderPanel.weights.${weight}`) }} · {{ objective[weight].toFixed(2) }}
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="objective[weight]"
            @input="setWeight(weight, $event)"
          />
        </label>
      </div>
    </details>

    <label class="recommender-panel__include-curves">
      <input
        v-model="includeCurves"
        type="checkbox"
      />
      {{ t('components.recommenderPanel.includeCurves') }}
    </label>
    <p
      v-if="includeCurves && scenario.arbitrageurs.count > 0"
      class="recommender-panel__hint"
    >
      {{
        t('components.recommenderPanel.anchoredCurves', {
          marketCap: formatAmount(scenario.arbitrageurs.fairMarketCapSol),
          openFrom: percentOf(ANCHOR_OPEN_FRACTIONS[0]),
          openTo: percentOf(ANCHOR_OPEN_FRACTIONS.at(-1)),
          graduateFrom: percentOf(ANCHOR_GRADUATION_FRACTIONS[0]),
          graduateTo: percentOf(ANCHOR_GRADUATION_FRACTIONS.at(-1)),
        })
      }}
    </p>

    <button
      type="button"
      class="recommender-panel__run"
      :disabled="searching"
      @click="run"
    >
      {{ searching ? t('components.recommenderPanel.searching') : t('components.recommenderPanel.run') }}
    </button>

    <p
      v-if="searchError"
      class="recommender-panel__hint"
      role="alert"
    >
      {{ t('components.recommenderPanel.searchFailed', { reason: searchError }) }}
    </p>

    <p
      v-if="result === null && ran"
      class="recommender-panel__hint"
    >
      {{ t('components.recommenderPanel.noResult') }}
    </p>

    <p
      v-if="result?.indistinguishable"
      class="recommender-panel__hint"
      role="status"
    >
      {{ t('components.recommenderPanel.indistinguishable') }}
    </p>

    <p
      v-if="result && !result.indistinguishable && result.undecided.length > 0"
      class="recommender-panel__hint"
      role="status"
    >
      {{
        t('components.recommenderPanel.undecided', {
          criteria: result.undecided.map((c) => t(`components.recommenderPanel.weights.${c}`)).join(', '),
        })
      }}
    </p>

    <ol
      v-if="result && !result.indistinguishable"
      class="recommender-panel__proposals"
    >
      <li
        v-for="proposal in result.proposals"
        :key="proposal.rank"
        class="recommender-panel__proposal"
      >
        <span class="recommender-panel__schedule">{{ proposalLabel(proposal) }}</span>
        <span class="recommender-panel__rationale">
          {{
            t('components.recommenderPanel.rationale', {
              human: formatSolChange(proposal.versusFlat.humanProfit),
              bots: formatSolChange(botProfit(proposal.candidate.metrics)),
              fees: formatSol(totalFees(proposal.candidate.metrics)),
              seeds: seedCount,
            })
          }}
        </span>
        <span class="recommender-panel__measures">
          {{ measuresLabel(proposal.candidate.metrics) }}
        </span>
        <button
          type="button"
          class="recommender-panel__use"
          @click="use(proposal)"
        >
          {{ t('components.recommenderPanel.use') }}
        </button>
      </li>
    </ol>
    <p
      v-if="result && !result.indistinguishable"
      class="recommender-panel__hint"
    >
      {{
        t('components.recommenderPanel.flatBaseline', {
          human: formatSolChange(result.flat.metrics.humanProfit),
          bots: formatSolChange(botProfit(result.flat.metrics)),
          measures: measuresLabel(result.flat.metrics),
        })
      }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { useFeeScheduleText } from '../../features/fee-text'
import { errorMessage, formatAmount, formatShare, formatSol, formatSolChange, PERCENT } from '../../core/shared'
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ANCHOR_GRADUATION_FRACTIONS, ANCHOR_OPEN_FRACTIONS, botProfit, Criterion, DEFAULT_SEARCH_SEEDS } from '../../core/config-search'
import type { MeanMetrics, Objective } from '../../core/config-search'
import type { CurveSpec, FeeSchedule } from '../../core/launch-config'
import { CurveShape, DEFAULT_LAUNCH_CONFIG, LAUNCH_PRESETS, UserPresetId, weightGrowthOf } from '../../core/launch-config'
import type { LaunchPreset } from '../../core/launch-config'
import { QUOTE_TOKENS } from '../../core/quote-token'
import type { QuoteToken } from '../../core/quote-token'
import { createRecommender, GOAL_OBJECTIVES, LaunchGoal, matchingPreset } from '../../features/recommendation'
import type { Proposal, Recommendation } from '../../features/recommendation'
import type { RecommenderPanelProps } from './types'

const props = defineProps<RecommenderPanelProps>()
const emit = defineEmits<{ use: [preset: LaunchPreset] }>()
const { t } = useI18n()
const feeScheduleText = useFeeScheduleText()

const goals = Object.values(LaunchGoal)
const weightKeys = Object.values(Criterion)
const seedCount = DEFAULT_SEARCH_SEEDS.length

const selectedGoal = ref<LaunchGoal | null>(LaunchGoal.FairLaunch)
const objective = ref<Objective>({ ...GOAL_OBJECTIVES[LaunchGoal.FairLaunch] })
const result = shallowRef<Recommendation | null>(null)
const searching = ref(false)
const ran = ref(false)
const searchError = ref<string | null>(null)
/** Bumped per search and per scenario change, so a superseded search's result is dropped. */
let latestRun = 0

// Proposals were measured under one scenario; a changed scenario makes them stale.
watch(
  () => props.scenario,
  () => {
    latestRun++
    searching.value = false
    result.value = null
    ran.value = false
  },
)

const selectGoal = (goal: LaunchGoal) => {
  selectedGoal.value = goal
  objective.value = { ...GOAL_OBJECTIVES[goal] }
}

const setWeight = (weight: Criterion, event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) return
  selectedGoal.value = null
  objective.value = { ...objective.value, [weight]: event.target.valueAsNumber }
}

const recommender = createRecommender()
onBeforeUnmount(recommender.dispose)
const includeCurves = ref(false)

const run = async () => {
  const runId = ++latestRun
  searching.value = true
  searchError.value = null
  try {
    const recommendation = await recommender.run({
      base: DEFAULT_LAUNCH_CONFIG,
      objective: objective.value,
      scenario: props.scenario,
      options: { includeCurves: includeCurves.value },
    })
    if (runId !== latestRun) return
    result.value = recommendation
    ran.value = true
  }
  catch (error) {
    if (runId === latestRun) searchError.value = errorMessage(error)
  }
  finally {
    if (runId === latestRun) searching.value = false
  }
}

const totalFees = (metrics: MeanMetrics): number => metrics.partnerCreatorFees + metrics.postGraduationFees

/** Every launch measure for one candidate, in plain words. */
const measuresLabel = (metrics: MeanMetrics): string =>
  [
    metrics.meanGraduationSeconds === null ?
        t('components.recommenderPanel.measures.neverGraduates') :
        t('components.recommenderPanel.measures.graduates', {
          rate: formatShare(metrics.graduationRate),
          seconds: Math.round(metrics.meanGraduationSeconds),
        }),
    t('components.recommenderPanel.measures.raised', { sol: formatSol(metrics.raised) }),
    t('components.recommenderPanel.measures.drawdown', { percent: Math.round(metrics.maxDrawdownPercent) }),
    metrics.botShareOfEarlyBuys === null ?
        t('components.recommenderPanel.measures.noEarlyBuys') :
        t('components.recommenderPanel.measures.botShare', { share: formatShare(metrics.botShareOfEarlyBuys) }),
    ...(props.scenario.arbitrageurs.count > 0 ?
        [t('components.recommenderPanel.measures.arbitrage', { sol: formatSolChange(metrics.arbitrageProfit) })] :
        []),
  ].join(' · ')

/** A fraction as a whole percent; absent reads as nothing. */
const percentOf = (fraction: number | undefined): string => (fraction === undefined ? '' : String(Math.round(fraction * PERCENT)))

/** The curve in plain words. */
const curveLabel = (curve: CurveSpec, quote: QuoteToken): string => {
  const symbol = QUOTE_TOKENS[quote].symbol
  switch (curve.curveShape) {
    case CurveShape.Standard:
      return t('components.recommenderPanel.curves.standard', { amount: curve.migrationQuoteThreshold, symbol })
    case CurveShape.LiquidityWeights:
      return t('components.recommenderPanel.curves.liquidity-weights', {
        from: curve.initialMarketCap,
        to: curve.migrationMarketCap,
        symbol,
        growth: weightGrowthOf(curve.liquidityWeights).toFixed(2),
      })
    default:
      return t(`components.recommenderPanel.curves.${curve.curveShape}`, {
        from: curve.initialMarketCap,
        to: curve.migrationMarketCap,
        symbol,
      })
  }
}

const proposalLabel = (proposal: Proposal): string =>
  proposal.candidate.curve ?
    `${scheduleLabel(proposal.candidate.schedule)} · ${curveLabel(proposal.candidate.curve, proposal.candidate.config.quoteToken)}` :
      scheduleLabel(proposal.candidate.schedule)

const scheduleLabel = (schedule: FeeSchedule): string => feeScheduleText(schedule, schedule.mode)

const use = (proposal: Proposal) => {
  const same = matchingPreset(proposal.candidate.config, LAUNCH_PRESETS)
  const intent = t('components.recommenderPanel.recommendedIntent', {
    human: formatSolChange(proposal.versusFlat.humanProfit),
    seeds: seedCount,
  })
  emit('use', {
    id: UserPresetId.Recommended,
    name: t('components.recommenderPanel.recommendedName', { schedule: proposalLabel(proposal) }),
    intent: same ? `${intent} ${t('components.recommenderPanel.sameAsPreset', { preset: same.name })}` : intent,
    config: proposal.candidate.config,
  })
}
</script>

<style lang="scss">
@use '../../styles/mixins';

.recommender-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  @include mixins.surface;
}

.recommender-panel__title {
  margin: 0;
  font-size: var(--font-size-3);
}

.recommender-panel__goals,
.recommender-panel__weights {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.recommender-panel__goal,
.recommender-panel__run,
.recommender-panel__use {
  @include mixins.control;
  cursor: pointer;
}

.recommender-panel__goal--active,
.recommender-panel__run:enabled {
  border-color: var(--color-gain);
}

.recommender-panel__run {
  align-self: flex-start;

  &:disabled {
    cursor: wait;
    color: var(--color-muted-foreground);
  }
}

.recommender-panel__weight {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.recommender-panel__label,
.recommender-panel__hint {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.recommender-panel__proposals {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding-left: var(--space-6);
}

.recommender-panel__proposal {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  align-items: baseline;
}

.recommender-panel__schedule {
  font-weight: var(--font-weight-strong);
}

.recommender-panel__include-curves {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.recommender-panel__advanced-toggle {
  cursor: pointer;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.recommender-panel__advanced[open] .recommender-panel__weights {
  margin-top: var(--space-3);
}

.recommender-panel__measures {
  flex-basis: 100%;
  font-size: var(--font-size-1);
  color: var(--color-muted-foreground);
}

.recommender-panel__rationale {
  flex: 1;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}
</style>
