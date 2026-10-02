import BN from 'bn.js'
import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import {
  baseFeeBpsAt,
  exitValue,
  FeeToken,
  simulateLaunch,
} from '../launch-simulator'
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
  generateTrades,
  groupOf,
  maxDrawdownPercent,
  toSol,
} from './utils'

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
): ScenarioResult => {
  const trades = generateTrades(spec, (at, amountIn) =>
    baseFeeBpsAt(parameters, at, amountIn),
  )
  const simulation = simulateLaunch(parameters, trades)
  const exitAt = Math.max(0, ...trades.map((t) => t.at)) + 1

  const empty = <T>(
    make: (group: TraderGroup) => T,
  ): Record<TraderGroup, T> => ({
    [TraderGroup.Sniper]: make(TraderGroup.Sniper),
    [TraderGroup.AdaptiveSniper]: make(TraderGroup.AdaptiveSniper),
    [TraderGroup.Human]: make(TraderGroup.Human),
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
  }

  const groups = empty((group) =>
    finalizeGroup(
      totals[group],
      held[group],
      exitValue(parameters, simulation, held[group], exitAt),
      traders[group],
    ),
  )

  return { simulation, groups }
}

/** Runs the scenario and reduces it to the SOL figures configs are compared on. */
export const scenarioMetrics = (
  parameters: ConfigParameters,
  spec: ScenarioSpec,
): ScenarioMetrics => {
  const { groups, simulation } = runScenario(parameters, spec)
  const earned = simulation.fees[FeeToken.Quote]
  const earnedAfter = simulation.migratedFees[FeeToken.Quote]
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
  }
}
