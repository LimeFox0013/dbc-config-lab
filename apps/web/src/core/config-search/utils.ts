import { CurveShape, FLAT_FEE_BPS, FLAT_SCHEDULE } from '../launch-config'
import type { CurveSpec } from '../launch-config'
import type { ScenarioMetrics, ScenarioSpec } from '../sniper-scenario'
import {
  ANCHOR_DECIMALS,
  ANCHOR_GRADUATION_FRACTIONS,
  ANCHOR_OPEN_FRACTIONS,
  Criterion,
  DEFAULT_CURVE_VARIANTS,
  GRADUATION_SPEED_SCALE_SECONDS,
  RELATIVE_SPREAD_TOLERANCE,
} from './constants'
import type { FeeSchedule } from '../launch-config'
import type {
  CriterionDefinition,
  MeanMetrics,
  Objective,
  SearchSpace,
} from './types'
import { clamp } from '../shared'

/** Every schedule in the space, plus the flat baseline. */
export const enumerateSchedules = (space: SearchSpace): FeeSchedule[] => [
  FLAT_SCHEDULE,
  ...space.modes.flatMap((mode) =>
    space.startingFeeBps.flatMap((startingFeeBps) =>
      space.windowSeconds.map((windowSeconds) => ({
        mode,
        startingFeeBps,
        endingFeeBps: FLAT_FEE_BPS,
        windowSeconds,
      })),
    ),
  ),
]

const mean = (values: number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / Math.max(values.length, 1)

/** Mean of the values present; null when none are. */
const meanOfPresent = (values: Array<number | null>): number | null => {
  const present = values.filter((v): v is number => v !== null)
  return present.length === 0 ? null : mean(present)
}

export const meanMetrics = (runs: ScenarioMetrics[]): MeanMetrics => ({
  sniperProfit: mean(runs.map((r) => r.sniperProfit)),
  adaptiveSniperProfit: mean(runs.map((r) => r.adaptiveSniperProfit)),
  humanProfit: mean(runs.map((r) => r.humanProfit)),
  humanFees: mean(runs.map((r) => r.humanFees)),
  partnerCreatorFees: mean(runs.map((r) => r.partnerCreatorFees)),
  postGraduationFees: mean(runs.map((r) => r.postGraduationFees)),
  graduationRate: mean(runs.map((r) => (r.graduated ? 1 : 0))),
  meanGraduationSeconds: meanOfPresent(runs.map((r) => r.graduationSeconds)),
  raised: mean(runs.map((r) => r.raised)),
  maxDrawdownPercent: mean(runs.map((r) => r.maxDrawdownPercent)),
  botShareOfEarlyBuys: meanOfPresent(runs.map((r) => r.botShareOfEarlyBuys)),
  arbitrageProfit: mean(runs.map((r) => r.arbitrageProfit)),
})

/** Profit of every bot, fast or fee-waiting — deterring one kind while the other wins is no win. */
export const botProfit = (metrics: MeanMetrics): number =>
  metrics.sniperProfit + metrics.adaptiveSniperProfit

export const CRITERIA: Record<Criterion, CriterionDefinition> = {
  [Criterion.HumanOutcome]: {
    value: (m) => m.humanProfit,
    higherIsBetter: true,
  },
  [Criterion.BotDeterrence]: { value: botProfit, higherIsBetter: false },
  [Criterion.FeeIncome]: {
    value: (m) => m.partnerCreatorFees + m.postGraduationFees,
    higherIsBetter: true,
  },
  [Criterion.Graduation]: {
    value: (m) =>
      m.meanGraduationSeconds === null
        ? 0
        : m.graduationRate /
          (1 + m.meanGraduationSeconds / GRADUATION_SPEED_SCALE_SECONDS),
    higherIsBetter: true,
  },
  [Criterion.Raise]: { value: (m) => m.raised, higherIsBetter: true },
  [Criterion.PriceStability]: {
    value: (m) => m.maxDrawdownPercent,
    higherIsBetter: false,
  },
  [Criterion.EarlyFairness]: {
    value: (m) => m.botShareOfEarlyBuys,
    higherIsBetter: false,
  },
  // What arbitrage takes from the launch; beyond zero the goal is met, and taxing the
  // traders who keep the price honest is not a better launch.
  [Criterion.FairPrice]: {
    value: (m) => Math.max(0, m.arbitrageProfit),
    higherIsBetter: false,
  },
}

const CRITERION_KEYS = Object.values(Criterion)

/** A full objective from the weights a goal names; unnamed criteria weigh 0. */
export const objectiveOf = (weights: Partial<Objective>): Objective => ({
  [Criterion.HumanOutcome]: weights[Criterion.HumanOutcome] ?? 0,
  [Criterion.BotDeterrence]: weights[Criterion.BotDeterrence] ?? 0,
  [Criterion.FeeIncome]: weights[Criterion.FeeIncome] ?? 0,
  [Criterion.Graduation]: weights[Criterion.Graduation] ?? 0,
  [Criterion.Raise]: weights[Criterion.Raise] ?? 0,
  [Criterion.PriceStability]: weights[Criterion.PriceStability] ?? 0,
  [Criterion.EarlyFairness]: weights[Criterion.EarlyFairness] ?? 0,
  [Criterion.FairPrice]: weights[Criterion.FairPrice] ?? 0,
})

/** Weights are clamped to [0, 1]; a non-number becomes 0. */
export const sanitizeObjective = (objective: Objective): Objective => {
  const weight = (criterion: Criterion) => clamp(objective[criterion], 0, 1)
  return {
    [Criterion.HumanOutcome]: weight(Criterion.HumanOutcome),
    [Criterion.BotDeterrence]: weight(Criterion.BotDeterrence),
    [Criterion.FeeIncome]: weight(Criterion.FeeIncome),
    [Criterion.Graduation]: weight(Criterion.Graduation),
    [Criterion.Raise]: weight(Criterion.Raise),
    [Criterion.PriceStability]: weight(Criterion.PriceStability),
    [Criterion.EarlyFairness]: weight(Criterion.EarlyFairness),
    [Criterion.FairPrice]: weight(Criterion.FairPrice),
  }
}

/**
 * Each weighted criterion is min-max scaled across the candidates (1 = best), then
 * combined as a weighted mean, so units never decide the ranking. A candidate without a
 * value for a criterion scores 0 on it. A criterion with one value for everyone adds
 * nothing; `indistinguishable` is true when that holds for every weighted criterion.
 */
export const scoreCandidates = (
  metrics: MeanMetrics[],
  objective: Objective,
): { scores: number[]; undecided: Criterion[]; indistinguishable: boolean } => {
  const weighted = CRITERION_KEYS.filter((c) => objective[c] > 0)
  const totalWeight = weighted.reduce((sum, c) => sum + objective[c], 0)
  const scaled = weighted.map((criterion) => {
    const { value, higherIsBetter } = CRITERIA[criterion]
    const values = metrics.map(value)
    const present = values.filter((v): v is number => v !== null)
    const min = Math.min(...present)
    const max = Math.max(...present)
    const spread = max - min
    const meaningful =
      present.length > 0 &&
      spread >
        RELATIVE_SPREAD_TOLERANCE * Math.max(Math.abs(max), Math.abs(min), 1)
    return {
      criterion,
      distinguishes: meaningful,
      scaled: values.map((v) => {
        if (v === null || !meaningful) return 0
        const fraction = (v - min) / spread
        return higherIsBetter ? fraction : 1 - fraction
      }),
    }
  })
  const scores = metrics.map((_, i) =>
    totalWeight === 0
      ? 0
      : scaled.reduce(
          (sum, s) => sum + objective[s.criterion] * s.scaled[i],
          0,
        ) / totalWeight,
  )
  const undecided = scaled
    .filter((s) => !s.distinguishes)
    .map((s) => s.criterion)
  return {
    scores,
    undecided,
    indistinguishable: undecided.length === scaled.length,
  }
}

const anchorScale = 10 ** ANCHOR_DECIMALS
const anchored = (fairMarketCapSol: number, fraction: number): number =>
  Math.round(fairMarketCapSol * fraction * anchorScale) / anchorScale

/** Market-cap curves opening below an outside market cap and graduating near it, in SOL. */
export const anchoredCurves = (fairMarketCapSol: number): CurveSpec[] =>
  ANCHOR_OPEN_FRACTIONS.flatMap((open) =>
    ANCHOR_GRADUATION_FRACTIONS.filter((graduate) => graduate > open).map(
      (graduate) => ({
        curveShape: CurveShape.MarketCap,
        initialMarketCap: anchored(fairMarketCapSol, open),
        migrationMarketCap: anchored(fairMarketCapSol, graduate),
      }),
    ),
  )

/**
 * The curves a widened search tries in a launch situation, in SOL. With traders who know
 * an outside price, curves placed relative to that price replace the general variants,
 * which all open far below it.
 */
export const curveVariantsFor = (scenario: ScenarioSpec): CurveSpec[] =>
  scenario.arbitrageurs.count > 0
    ? anchoredCurves(scenario.arbitrageurs.fairMarketCapSol)
    : DEFAULT_CURVE_VARIANTS
