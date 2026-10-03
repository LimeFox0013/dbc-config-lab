import BN from 'bn.js'
import { feeTotal, TradeSide, TradeStatus } from '../launch-simulator'
import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { Trade, TradeOutcome } from '../launch-simulator'
import { quoteUnitsFromSol } from '../quote-token'
import type { QuoteToken } from '../quote-token'
import {
  EARLY_WINDOW_SECONDS,
  TRADER_ID_SEPARATOR,
  TraderGroup,
} from './constants'
import type {
  FeeBpsAt,
  GroupOutcome,
  Range,
  ScenarioSpec,
  TradeContext,
} from './types'
import { BPS_SCALE, PRICE_X128_SHIFT } from '../shared'

/** mulberry32 — small seeded PRNG, so a scenario reruns identically from its seed. */
export const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const between = (random: () => number, range: Range): number =>
  range.min + random() * (range.max - range.min)

export const traderId = (group: TraderGroup, index: number): Trade['trader'] =>
  `${group}${TRADER_ID_SEPARATOR}${index}`

const TRADER_GROUPS: readonly string[] = Object.values(TraderGroup)
const isTraderGroup = (value: string): value is TraderGroup =>
  TRADER_GROUPS.includes(value)

export const groupOf = (trader: Trade['trader']): TraderGroup => {
  const [group = ''] = trader.split(TRADER_ID_SEPARATOR)
  if (!isTraderGroup(group))
    throw new Error(`Unknown trader group in ${trader}`)
  return group
}

/** First whole second up to `maxWait` at which the fee for this buy is within the limit. */
const firstAffordableSecond = (
  feeBpsAt: FeeBpsAt,
  amountIn: BN,
  maxFeeBps: number,
  maxWait: number,
): number =>
  Array.from({ length: maxWait + 1 }, (_, second) => second).find(
    (second) => feeBpsAt(second, amountIn) <= maxFeeBps,
  ) ?? maxWait

/**
 * The scenario's trades. Random draws depend only on the spec and seed, in a fixed
 * order (snipers, humans, adaptive snipers, arbitrageurs); the only config-dependent
 * decision made here is when an adaptive sniper buys, read from `feeBpsAt` — whether an
 * arbitrageur buys or sells is decided by the replay at the live price. Budgets are
 * written in SOL and spent in the config's quote token at the reference rate.
 */
export const generateTrades = (
  spec: ScenarioSpec,
  { feeBpsAt, quote, fairPriceX128 }: TradeContext,
): Trade[] => {
  const random = seededRandom(spec.seed)
  const budget = (range: Range): BN =>
    quoteUnitsFromSol(between(random, range), quote)
  const { snipers, humans, adaptiveSnipers, arbitrageurs } = spec

  const sniperTrades = Array.from(
    { length: snipers.count },
    (_, index): Trade[] => {
      const trader = traderId(TraderGroup.Sniper, index)
      const at = Math.floor(random() * (snipers.buyWithinSeconds + 1))
      return [
        {
          at,
          side: TradeSide.Buy,
          amountIn: budget(snipers.solPerBuy),
          trader,
        },
        { at: at + snipers.holdSeconds, side: TradeSide.SellAll, trader },
      ]
    },
  ).flat()

  const humanTrades = Array.from(
    { length: humans.count },
    (_, index): Trade => ({
      at: Math.floor(
        between(random, {
          min: humans.arriveFromSeconds,
          max: humans.arriveUntilSeconds,
        }),
      ),
      side: TradeSide.Buy,
      amountIn: budget(humans.solPerBuy),
      trader: traderId(TraderGroup.Human, index),
    }),
  )

  const adaptiveTrades = Array.from(
    { length: adaptiveSnipers.count },
    (_, index): Trade[] => {
      const trader = traderId(TraderGroup.AdaptiveSniper, index)
      const amountIn = budget(adaptiveSnipers.solPerBuy)
      const at = firstAffordableSecond(
        feeBpsAt,
        amountIn,
        adaptiveSnipers.maxFeeBps,
        adaptiveSnipers.maxWaitSeconds,
      )
      return [
        { at, side: TradeSide.Buy, amountIn, trader },
        {
          at: at + adaptiveSnipers.holdSeconds,
          side: TradeSide.SellAll,
          trader,
        },
      ]
    },
  ).flat()

  const fairPrice = fairPriceX128
  const arbitrageTrades = !fairPrice
    ? []
    : Array.from({ length: arbitrageurs.count }, (_, index): Trade[] => {
        const trader = traderId(TraderGroup.Arbitrageur, index)
        const clip = budget(arbitrageurs.solPerTrade)
        const first = Math.floor(random() * arbitrageurs.checkEverySeconds)
        const checks = Math.floor(
          (arbitrageurs.untilSeconds - first) / arbitrageurs.checkEverySeconds,
        )
        return Array.from(
          { length: Math.max(0, checks + 1) },
          (_, check): Trade => ({
            at: first + check * arbitrageurs.checkEverySeconds,
            side: TradeSide.TowardFairPrice,
            trader,
            clip,
            gapBps: arbitrageurs.gapBps,
            fairPriceX128: fairPrice,
          }),
        )
      }).flat()

  return [
    ...sniperTrades,
    ...humanTrades,
    ...adaptiveTrades,
    ...arbitrageTrades,
  ]
}

/**
 * The scenario's outside price per base unit, 2^128-scaled, in the config's quote token;
 * null when the scenario has no arbitrageurs or the config's supply is not fixed.
 */
export const fairPriceX128Of = (
  parameters: ConfigParameters,
  spec: ScenarioSpec,
  quote: QuoteToken,
): BN | null => {
  const supply = parameters.tokenSupply?.preMigrationTokenSupply
  if (spec.arbitrageurs.count === 0 || !supply || supply.isZero()) return null
  return quoteUnitsFromSol(spec.arbitrageurs.fairMarketCapSol, quote)
    .shln(PRICE_X128_SHIFT)
    .div(supply)
}

export const emptyGroupOutcome = (group: TraderGroup): GroupOutcome => ({
  group,
  traders: 0,
  spent: new BN(0),
  received: new BN(0),
  feesPaid: new BN(0),
  tokensHeld: new BN(0),
  heldValue: new BN(0),
  profit: new BN(0),
})

export const addOutcome = (
  group: GroupOutcome,
  outcome: TradeOutcome,
): GroupOutcome =>
  outcome.trade.side === TradeSide.Buy
    ? {
        ...group,
        spent: group.spent.add(outcome.amountInUsed),
        feesPaid: group.feesPaid.add(feeTotal(outcome.feeValue)),
      }
    : {
        ...group,
        received: group.received.add(outcome.amountOut),
        feesPaid: group.feesPaid.add(feeTotal(outcome.feeValue)),
      }

const isExecuted = (outcome: TradeOutcome): boolean =>
  outcome.status !== TradeStatus.Rejected

/** Largest fall from a running peak, in percent, along the prices trades executed at. */
export const maxDrawdownPercent = (outcomes: TradeOutcome[]): number =>
  outcomes.filter(isExecuted).reduce(
    (acc, outcome) => {
      const sqrtPrice = Number(outcome.sqrtPriceAfter.toString())
      const peak = Math.max(acc.peak, sqrtPrice)
      const drawdown = peak > 0 ? (1 - (sqrtPrice / peak) ** 2) * 100 : 0
      return { peak, worst: Math.max(acc.worst, drawdown) }
    },
    { peak: 0, worst: 0 },
  ).worst

/** Share of tokens bought in the early window that went to bots of either kind. */
export const botShareOfEarlyBuys = (
  outcomes: TradeOutcome[],
): number | null => {
  const early = outcomes.filter(
    (o) =>
      isExecuted(o) &&
      o.trade.side === TradeSide.Buy &&
      o.trade.at < EARLY_WINDOW_SECONDS,
  )
  const total = early.reduce((sum, o) => sum.add(o.amountOut), new BN(0))
  if (total.isZero()) return null
  const bots = early
    .filter((o) => groupOf(o.trade.trader) !== TraderGroup.Human)
    .reduce((sum, o) => sum.add(o.amountOut), new BN(0))
  return Number(bots.muln(BPS_SCALE).div(total).toString()) / BPS_SCALE
}
