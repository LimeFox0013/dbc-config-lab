import { compileLaunchConfig } from '../../core/launch-config'
import type { LaunchPreset } from '../../core/launch-config'
import BN from 'bn.js'
import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { TradeStatus } from '../../core/launch-simulator'
import type { SimulationResult } from '../../core/launch-simulator'
import { metricsOf, runScenario } from '../../core/sniper-scenario'
import type { ScenarioSpec } from '../../core/sniper-scenario'
import { clamp } from '../../core/shared'
import { MULTIPLE_PRECISION, SCENARIO_LIMITS } from './constants'
import type { ComparisonEntry, ComparisonRow, PricePoint } from './types'
import type { QuoteToken } from '../../core/quote-token'

const clampInteger = (value: number, min: number, max: number): number =>
  clamp(Math.trunc(value), min, max)

/** Brings user-edited scenario sizes back into the supported range. */
/** Arbitrage traders check less often when their total checks would exceed the cap. */
const cappedArbitrage = (
  arbitrageurs: ScenarioSpec['arbitrageurs'],
): ScenarioSpec['arbitrageurs'] => {
  const checks =
    (arbitrageurs.count * arbitrageurs.untilSeconds) /
    arbitrageurs.checkEverySeconds
  return checks <= SCENARIO_LIMITS.maxArbitrageChecks
    ? arbitrageurs
    : {
        ...arbitrageurs,
        checkEverySeconds: Math.ceil(
          (arbitrageurs.count * arbitrageurs.untilSeconds) /
            SCENARIO_LIMITS.maxArbitrageChecks,
        ),
      }
}

export const sanitizeScenario = (spec: ScenarioSpec): ScenarioSpec => ({
  ...spec,
  seed: clampInteger(spec.seed, 0, SCENARIO_LIMITS.maxSeed),
  snipers: {
    ...spec.snipers,
    count: clampInteger(
      spec.snipers.count,
      SCENARIO_LIMITS.minTraders,
      SCENARIO_LIMITS.maxTraders,
    ),
  },
  humans: {
    ...spec.humans,
    count: clampInteger(
      spec.humans.count,
      SCENARIO_LIMITS.minTraders,
      SCENARIO_LIMITS.maxTraders,
    ),
  },
  adaptiveSnipers: {
    ...spec.adaptiveSnipers,
    count: clampInteger(
      spec.adaptiveSnipers.count,
      SCENARIO_LIMITS.minTraders,
      SCENARIO_LIMITS.maxTraders,
    ),
    maxWaitSeconds: clampInteger(
      spec.adaptiveSnipers.maxWaitSeconds,
      0,
      SCENARIO_LIMITS.maxWaitSeconds,
    ),
  },
  arbitrageurs: cappedArbitrage({
    ...spec.arbitrageurs,
    count: clampInteger(
      spec.arbitrageurs.count,
      SCENARIO_LIMITS.minTraders,
      SCENARIO_LIMITS.maxTraders,
    ),
    fairMarketCapSol: clamp(
      Number.isFinite(spec.arbitrageurs.fairMarketCapSol)
        ? spec.arbitrageurs.fairMarketCapSol
        : SCENARIO_LIMITS.minFairMarketCapSol,
      SCENARIO_LIMITS.minFairMarketCapSol,
      SCENARIO_LIMITS.maxFairMarketCapSol,
    ),
    checkEverySeconds: clampInteger(
      spec.arbitrageurs.checkEverySeconds,
      SCENARIO_LIMITS.minCheckEverySeconds,
      SCENARIO_LIMITS.maxArbitrageSeconds,
    ),
    untilSeconds: clampInteger(
      spec.arbitrageurs.untilSeconds,
      0,
      SCENARIO_LIMITS.maxArbitrageSeconds,
    ),
    gapBps: clampInteger(
      spec.arbitrageurs.gapBps,
      0,
      SCENARIO_LIMITS.maxGapBps,
    ),
  }),
  unlockedLiquidityPulled: spec.unlockedLiquidityPulled === true,
})

/** A preset as a comparison entry, compiled once. */
/** An entry for parameters already compiled — a config read from chain, or a clone of one. */
export const parametersEntry = (
  label: Pick<ComparisonEntry, 'id' | 'name' | 'intent'>,
  parameters: ConfigParameters,
  quoteToken: QuoteToken,
): ComparisonEntry => ({
  ...label,
  compiled: { ok: true, parameters, quoteToken },
})

export const presetEntry = (preset: LaunchPreset): ComparisonEntry => ({
  id: preset.id,
  name: preset.name,
  intent: preset.intent,
  compiled: compileLaunchConfig(preset.config),
})

const precision = new BN(MULTIPLE_PRECISION)

/** (sqrtPrice / sqrtStart)², as a float; prices share the Q64 scale on both venues. */
const multipleOf = (sqrtPrice: BN, sqrtStart: BN): number =>
  Number(
    sqrtPrice
      .mul(sqrtPrice)
      .mul(precision)
      .div(sqrtStart.mul(sqrtStart))
      .toString(),
  ) / MULTIPLE_PRECISION

/** Price after each executed trade, from the opening price, curve and migrated pool alike. */
export const pricePath = (
  parameters: ConfigParameters,
  simulation: SimulationResult,
): PricePoint[] => [
  { at: 0, multiple: 1 },
  ...simulation.outcomes
    .filter((outcome) => outcome.status !== TradeStatus.Rejected)
    .map((outcome) => ({
      at: outcome.trade.at,
      multiple: multipleOf(outcome.sqrtPriceAfter, parameters.sqrtStartPrice),
    })),
]

export const compareRow = (
  entry: ComparisonEntry,
  spec: ScenarioSpec,
): ComparisonRow => {
  if (!entry.compiled.ok)
    return { entry, ok: false, reason: entry.compiled.reason }
  const { parameters, quoteToken } = entry.compiled
  const result = runScenario(parameters, spec, quoteToken)
  return {
    entry,
    ok: true,
    metrics: metricsOf(result, quoteToken),
    path: pricePath(parameters, result.simulation),
  }
}

export const compareConfigs = (
  entries: ComparisonEntry[],
  spec: ScenarioSpec,
): ComparisonRow[] => {
  const safeSpec = sanitizeScenario(spec)
  return entries.map((entry) => compareRow(entry, safeSpec))
}
