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

const clampInteger = (value: number, min: number, max: number): number =>
  clamp(Math.trunc(value), min, max)

/** Brings user-edited scenario sizes back into the supported range. */
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
  },
  unlockedLiquidityPulled: spec.unlockedLiquidityPulled === true,
})

/** A preset as a comparison entry, compiled once. */
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
  const { parameters } = entry.compiled
  const result = runScenario(parameters, spec)
  return {
    entry,
    ok: true,
    metrics: metricsOf(result),
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

const solFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const signedSolFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
})

/** SOL amount with two decimals, e.g. "0.61". */
export const formatSol = (sol: number): string => solFormat.format(sol)

/** Signed SOL change with two decimals, e.g. "+1.04" or "-4.76". */
export const formatSolChange = (sol: number): string =>
  signedSolFormat.format(sol)

const shareFormat = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 0,
})

/** A 0–1 share as a whole percent, e.g. "35%". */
export const formatShare = (share: number): string => shareFormat.format(share)
