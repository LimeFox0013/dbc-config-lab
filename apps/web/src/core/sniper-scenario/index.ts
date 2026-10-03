import BN from 'bn.js'
import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import {
  baseFeeBpsAt,
  BPS_SCALE,
  exitValue,
  PRICE_X128_SHIFT,
  simulateLaunch,
  Venue,
} from '../launch-simulator'
import type { SimulationResult } from '../launch-simulator'
import { TraderGroup } from './constants'
import type {
  GroupOutcome,
  ScenarioMetrics,
  ScenarioResult,
  ScenarioSpec,
} from './types'
import {
  addOutcome,
  botShareOfEarlyBuys,
  emptyGroupOutcome,
  fairPriceX128Of,
  generateTrades,
  groupOf,
  maxDrawdownPercent,
} from './utils'
import { solFromQuoteUnits } from '../quote-token'
import type { QuoteToken } from '../quote-token'

export {
  DEFAULT_SCENARIO,
  SCENARIO_PRESETS,
  ScenarioPresetId,
  TraderGroup,
} from './constants'
export type {
  GroupOutcome,
  Range,
  ScenarioMetrics,
  ScenarioResult,
  ScenarioSpec,
} from './types'
export { generateTrades } from './utils'

const finalizeGroup = (
  group: GroupOutcome,
  tokensHeld: GroupOutcome['tokensHeld'],
  heldValue: GroupOutcome['heldValue'],
  traders: number,
): GroupOutcome => ({
  ...group,
  traders,
  tokensHeld,
  heldValue,
  profit: group.received.add(heldValue).sub(group.spent),
})

/** Runs the scenario's trades against one config and totals each trader group's outcome. */
export const runScenario = (
  parameters: ConfigParameters,
  spec: ScenarioSpec,
  quote: QuoteToken,
): ScenarioResult => {
  const fairPriceX128 = fairPriceX128Of(parameters, spec, quote)
  const trades = generateTrades(spec, {
    feeBpsAt: (at, amountIn) => baseFeeBpsAt(parameters, at, amountIn),
    quote,
    fairPriceX128,
  })
  const simulation = simulateLaunch(parameters, trades, {
    unlockedLiquidityPulled: spec.unlockedLiquidityPulled,
  })
  const exitAt = Math.max(0, ...trades.map((t) => t.at)) + 1

  const empty = <T>(
    make: (group: TraderGroup) => T,
  ): Record<TraderGroup, T> => ({
    [TraderGroup.Sniper]: make(TraderGroup.Sniper),
    [TraderGroup.AdaptiveSniper]: make(TraderGroup.AdaptiveSniper),
    [TraderGroup.Human]: make(TraderGroup.Human),
    [TraderGroup.Arbitrageur]: make(TraderGroup.Arbitrageur),
  })

  const totals = simulation.outcomes.reduce((acc, outcome) => {
    const group = groupOf(outcome.trade.trader)
    return { ...acc, [group]: addOutcome(acc[group], outcome) }
  }, empty(emptyGroupOutcome))

  const held = Object.entries(simulation.holdings).reduce(
    (acc, [trader, tokens]) => {
      const group = groupOf(trader)
      return { ...acc, [group]: acc[group].add(tokens) }
    },
    empty(() => new BN(0)),
  )

  const traders: Record<TraderGroup, number> = {
    [TraderGroup.Sniper]: spec.snipers.count,
    [TraderGroup.AdaptiveSniper]: spec.adaptiveSnipers.count,
    [TraderGroup.Human]: spec.humans.count,
    [TraderGroup.Arbitrageur]: fairPriceX128 ? spec.arbitrageurs.count : 0,
  }

  // With an outside market, held tokens can be sold there; otherwise only into this pool.
  const heldValue = (tokens: BN): BN =>
    fairPriceX128
      ? tokens.mul(fairPriceX128).shrn(PRICE_X128_SHIFT)
      : exitValue(parameters, simulation, tokens, exitAt)

  const groups = empty((group) =>
    finalizeGroup(
      totals[group],
      held[group],
      heldValue(held[group]),
      traders[group],
    ),
  )

  return { simulation, groups, fairPriceX128 }
}

/** The final live price's distance from the outside price, in percent. */
const fairValueGapPercent = (
  simulation: SimulationResult,
  fairPriceX128: BN,
): number => {
  const sqrtPrice =
    simulation.migratedPool?.sqrtPrice ??
    simulation.finalPool.poolState.sqrtPrice
  const live = sqrtPrice.mul(sqrtPrice)
  return Number(live.muln(BPS_SCALE).div(fairPriceX128).toString()) / 100 - 100
}

/** Reduces a scenario run to the SOL figures configs are compared on. */
export const metricsOf = (
  { groups, simulation, fairPriceX128 }: ScenarioResult,
  quote: QuoteToken,
): ScenarioMetrics => {
  const toSol = (units: BN): number => solFromQuoteUnits(units, quote)
  const earned = simulation.feeValue[Venue.Curve]
  const earnedAfter = simulation.feeValue[Venue.Migrated]
  return {
    sniperProfit: toSol(groups[TraderGroup.Sniper].profit),
    adaptiveSniperProfit: toSol(groups[TraderGroup.AdaptiveSniper].profit),
    humanProfit: toSol(groups[TraderGroup.Human].profit),
    humanFees: toSol(groups[TraderGroup.Human].feesPaid),
    partnerCreatorFees: toSol(earned.partner.add(earned.creator)),
    postGraduationFees: toSol(earnedAfter.partner.add(earnedAfter.creator)),
    graduated: simulation.graduatedAt !== null,
    graduationSeconds: simulation.graduatedAt,
    raised: toSol(simulation.finalPool.poolState.quoteReserve),
    maxDrawdownPercent: maxDrawdownPercent(simulation.outcomes),
    botShareOfEarlyBuys: botShareOfEarlyBuys(simulation.outcomes),
    liquidityPulled: simulation.liquidityPulled
      ? toSol(simulation.liquidityPulled.value)
      : null,
    arbitrageProfit: toSol(groups[TraderGroup.Arbitrageur].profit),
    fairValueGapPercent: fairPriceX128
      ? fairValueGapPercent(simulation, fairPriceX128)
      : null,
  }
}

/** Runs the scenario and reduces it to the SOL figures configs are compared on. */
export const scenarioMetrics = (
  parameters: ConfigParameters,
  spec: ScenarioSpec,
  quote: QuoteToken,
): ScenarioMetrics => metricsOf(runScenario(parameters, spec, quote), quote)
