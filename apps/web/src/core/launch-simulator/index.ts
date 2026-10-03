import BN from 'bn.js'
import {
  FEE_DENOMINATOR,
  getBaseFeeHandler,
  getFeeMode,
  swapQuotePartialFill,
  TradeDirection,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type {
  ConfigParameters,
  PoolConfig,
  SwapQuote2Result,
  VirtualPool,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import {
  DEFAULT_SIMULATION_OPTIONS,
  FeeToken,
  TradeSide,
  TradeStatus,
  Venue,
} from './constants'
import type {
  FeeShares,
  SimulationOptions,
  SimulationResult,
  Trade,
  TradeOutcome,
} from './types'
import {
  addFeeShares,
  emptyFeeShares,
  feeValueInQuote,
  nextQuoteReserve,
  pointAt,
  splitTradingFee,
  timestampAt,
  toInitialPool,
  toPoolConfig,
  trackerAfterSwap,
  trackerBeforeSwap,
} from './utils'
import { errorMessage } from '../shared'
import {
  afterMigratedSwap,
  migratedUnsupportedReason,
  quoteMigratedSwap,
  toMigratedPool,
  withUnlockedLiquidityPulled,
} from '../migrated-pool'
import type {
  MigratedPool,
  MigratedSwap,
  PulledLiquidity,
} from '../migrated-pool'

export {
  FeeToken,
  SLOT_DURATION_MS,
  TradeSide,
  TradeStatus,
  Venue,
} from './constants'
export type {
  FeeShares,
  SimulationOptions,
  SimulationResult,
  Trade,
  TradeOutcome,
} from './types'
export { feeTotal } from './utils'

type Replay = Omit<SimulationResult, 'finalPool' | 'migratedPool'> & {
  pool: VirtualPool
  migrated: MigratedPool | null
}

const rejected = (
  trade: Trade,
  replay: Replay,
  reason: string,
): TradeOutcome => ({
  trade,
  venue: replay.graduatedAt === null ? Venue.Curve : Venue.Migrated,
  status: TradeStatus.Rejected,
  amountInUsed: new BN(0),
  amountOut: new BN(0),
  fee: emptyFeeShares(),
  feeToken: FeeToken.Quote,
  feeValue: emptyFeeShares(),
  sqrtPriceAfter: replay.migrated?.sqrtPrice ?? replay.pool.poolState.sqrtPrice,
  quoteReserveAfter: replay.pool.poolState.quoteReserve,
  reason,
})

/*
 * A replay's outcome list and holdings map belong to a single simulateLaunch call and never
 * escape it mid-run, so they are extended in place: copying them on every trade made a
 * launch O(trades × traders). Everything simulateLaunch returns is still a fresh value.
 */
const appended = (
  outcomes: TradeOutcome[],
  outcome: TradeOutcome,
): TradeOutcome[] => {
  outcomes.push(outcome)
  return outcomes
}

const withHolding = (
  holdings: Replay['holdings'],
  trader: Trade['trader'],
  amount: BN,
): Replay['holdings'] => {
  holdings[trader] = amount
  return holdings
}

const holdingOf = (replay: Replay, trader: Trade['trader']): BN =>
  replay.holdings[trader] ?? new BN(0)

/** Input amount of a trade, resolving sell-all against the trader's current holding. */
const amountInOf = (replay: Replay, trade: Trade): BN =>
  trade.side === TradeSide.SellAll
    ? holdingOf(replay, trade.trader)
    : trade.amountIn

const holdingAfter = (
  replay: Replay,
  trade: Trade,
  consumed: BN,
  received: BN,
): BN =>
  trade.side === TradeSide.Buy
    ? holdingOf(replay, trade.trader).add(received)
    : holdingOf(replay, trade.trader).sub(consumed)

/** LP fees on the migrated pool go to partner and creator in proportion to their LP shares. */
const splitLpFee = (
  lpFee: BN,
  protocolFee: BN,
  referralFee: BN,
  parameters: ConfigParameters,
): FeeShares => {
  const partnerPercent =
    parameters.partnerLiquidityPercentage +
    parameters.partnerPermanentLockedLiquidityPercentage +
    parameters.partnerLiquidityVestingInfo.vestingPercentage
  const partner = lpFee.muln(partnerPercent).divn(100)
  return {
    partner,
    creator: lpFee.sub(partner),
    protocol: protocolFee,
    referral: referralFee,
  }
}

/** A trade on the pool the launch migrated to, priced by the DAMM v2 SDK. */
const applyMigratedTrade = (
  parameters: ConfigParameters,
  replay: Replay,
  migrated: MigratedPool,
  trade: Trade,
  amountIn: BN,
): Replay => {
  const isSell = trade.side !== TradeSide.Buy
  let swap: MigratedSwap
  try {
    swap = quoteMigratedSwap(migrated, isSell, amountIn, trade.at)
  } catch (error) {
    return {
      ...replay,
      outcomes: appended(
        replay.outcomes,
        rejected(trade, replay, errorMessage(error)),
      ),
    }
  }
  const { quote } = swap
  const fee = splitLpFee(
    quote.claimingFee,
    quote.protocolFee,
    quote.referralFee,
    parameters,
  )
  const feeToken = swap.feesOnBaseToken ? FeeToken.Base : FeeToken.Quote
  const feeValue = feeValueInQuote(
    fee,
    feeToken,
    !isSell,
    quote.includedFeeInputAmount,
    quote.outputAmount,
  )
  const outcome: TradeOutcome = {
    trade,
    venue: Venue.Migrated,
    status: TradeStatus.Filled,
    amountInUsed: quote.includedFeeInputAmount,
    amountOut: quote.outputAmount,
    fee,
    feeToken,
    feeValue,
    sqrtPriceAfter: quote.nextSqrtPrice,
    quoteReserveAfter: replay.pool.poolState.quoteReserve,
  }
  return {
    ...replay,
    migrated: afterMigratedSwap(migrated, swap),
    outcomes: appended(replay.outcomes, outcome),
    migratedFees: {
      ...replay.migratedFees,
      [feeToken]: addFeeShares(replay.migratedFees[feeToken], fee),
    },
    feeValue: {
      ...replay.feeValue,
      [Venue.Migrated]: addFeeShares(replay.feeValue[Venue.Migrated], feeValue),
    },
    holdings: withHolding(
      replay.holdings,
      trade.trader,
      holdingAfter(
        replay,
        trade,
        quote.includedFeeInputAmount,
        quote.outputAmount,
      ),
    ),
  }
}

/** The pool the program opens at graduation, less any liquidity withdrawn right after. */
const openMigratedPool = (
  parameters: ConfigParameters,
  config: PoolConfig,
  options: SimulationOptions,
): { pool: MigratedPool; pulled: PulledLiquidity | null } => {
  const pool = toMigratedPool(parameters, config)
  return options.unlockedLiquidityPulled
    ? withUnlockedLiquidityPulled(parameters, pool)
    : { pool, pulled: null }
}

const applyTrade =
  (
    parameters: ConfigParameters,
    config: PoolConfig,
    options: SimulationOptions,
  ) =>
  (replay: Replay, trade: Trade): Replay => {
    const { pool } = replay
    const reject = (reason: string): Replay => ({
      ...replay,
      outcomes: appended(replay.outcomes, rejected(trade, replay, reason)),
    })

    const isBuy = trade.side === TradeSide.Buy
    const amountIn = amountInOf(replay, trade)
    if (!isBuy && amountIn.gt(holdingOf(replay, trade.trader)))
      return reject('Insufficient balance')

    if (replay.migrated)
      return applyMigratedTrade(
        parameters,
        replay,
        replay.migrated,
        trade,
        amountIn,
      )
    if (replay.graduatedAt !== null)
      return reject(
        `Migrated pool not simulated: ${migratedUnsupportedReason(parameters) ?? 'unknown reason'}`,
      )

    const direction = isBuy
      ? TradeDirection.QuoteToBase
      : TradeDirection.BaseToQuote
    const feeMode = getFeeMode(config.collectFeeMode, direction, false)

    const timestamp = timestampAt(trade.at)
    const { dynamicFee } = config.poolFees
    const hasDynamicFee = dynamicFee.initialized !== 0
    const tracker = hasDynamicFee
      ? trackerBeforeSwap(
          pool.poolState.volatilityTracker,
          dynamicFee,
          pool.poolState.sqrtPrice,
          timestamp,
        )
      : pool.poolState.volatilityTracker

    let quote: SwapQuote2Result
    try {
      quote = swapQuotePartialFill(
        { poolState: { ...pool.poolState, volatilityTracker: tracker } },
        config,
        !isBuy,
        amountIn,
        0,
        false,
        pointAt(trade.at, parameters.activationType),
        false,
      )
    } catch (error) {
      return reject(errorMessage(error))
    }

    const quoteReserveAfter = nextQuoteReserve(
      pool,
      quote,
      isBuy,
      feeMode.feesOnInput,
    )
    const fee = splitTradingFee(
      quote.tradingFee,
      quote.protocolFee,
      quote.referralFee,
      config.creatorTradingFeePercentage,
    )
    const feeToken = feeMode.feesOnBaseToken ? FeeToken.Base : FeeToken.Quote
    const feeValue = feeValueInQuote(
      fee,
      feeToken,
      isBuy,
      quote.includedFeeInputAmount,
      quote.outputAmount,
    )
    const outcome: TradeOutcome = {
      trade,
      venue: Venue.Curve,
      status: quote.amountLeft.isZero()
        ? TradeStatus.Filled
        : TradeStatus.PartiallyFilled,
      amountInUsed: quote.includedFeeInputAmount,
      amountOut: quote.outputAmount,
      fee,
      feeToken,
      feeValue,
      sqrtPriceAfter: quote.nextSqrtPrice,
      quoteReserveAfter,
    }
    const graduatesNow =
      replay.graduatedAt === null &&
      quoteReserveAfter.gte(config.migrationQuoteThreshold)
    const opened =
      graduatesNow && migratedUnsupportedReason(parameters) === null
        ? openMigratedPool(parameters, config, options)
        : null

    return {
      ...replay,
      pool: {
        poolState: {
          ...pool.poolState,
          sqrtPrice: quote.nextSqrtPrice,
          quoteReserve: quoteReserveAfter,
          volatilityTracker: hasDynamicFee
            ? trackerAfterSwap(
                tracker,
                dynamicFee,
                pool.poolState.sqrtPrice,
                quote.nextSqrtPrice,
                timestamp,
              )
            : tracker,
        },
      },
      migrated: opened?.pool ?? replay.migrated,
      liquidityPulled: opened ? opened.pulled : replay.liquidityPulled,
      outcomes: appended(replay.outcomes, outcome),
      graduatedAt: graduatesNow ? trade.at : replay.graduatedAt,
      fees: {
        ...replay.fees,
        [feeToken]: addFeeShares(replay.fees[feeToken], fee),
      },
      feeValue: {
        ...replay.feeValue,
        [Venue.Curve]: addFeeShares(replay.feeValue[Venue.Curve], feeValue),
      },
      holdings: withHolding(
        replay.holdings,
        trade.trader,
        holdingAfter(
          replay,
          trade,
          quote.includedFeeInputAmount,
          quote.outputAmount,
        ),
      ),
    }
  }

/**
 * Replays trades, in time order, against a fresh pool for these config parameters using
 * the SDK's own swap math. Offline and deterministic.
 */
export const simulateLaunch = (
  parameters: ConfigParameters,
  trades: Trade[],
  options: SimulationOptions = DEFAULT_SIMULATION_OPTIONS,
): SimulationResult => {
  const initial: Replay = {
    pool: toInitialPool(parameters),
    outcomes: [],
    graduatedAt: null,
    fees: {
      [FeeToken.Quote]: emptyFeeShares(),
      [FeeToken.Base]: emptyFeeShares(),
    },
    migratedFees: {
      [FeeToken.Quote]: emptyFeeShares(),
      [FeeToken.Base]: emptyFeeShares(),
    },
    feeValue: {
      [Venue.Curve]: emptyFeeShares(),
      [Venue.Migrated]: emptyFeeShares(),
    },
    holdings: {},
    liquidityPulled: null,
    migrated: null,
  }
  const ordered = [...trades].sort((a, b) => a.at - b.at)
  const { pool, migrated, ...result } = ordered.reduce(
    applyTrade(parameters, toPoolConfig(parameters), options),
    initial,
  )
  return { ...result, finalPool: pool, migratedPool: migrated }
}

/** Quote lamports to `tokens` at the pool's spot price: tokens × (sqrtPrice / 2^64)². */
const spotValue = (tokens: BN, pool: VirtualPool): BN =>
  tokens.mul(pool.poolState.sqrtPrice).mul(pool.poolState.sqrtPrice).shrn(128)

/**
 * Quote lamports `tokens` would fetch if sold in one trade at the end, after fees, on
 * whichever venue is live: the migrated pool once the launch graduated, otherwise the
 * curve. Spot price is used only for a graduated launch whose migrated pool the model
 * refuses to simulate.
 */
export const exitValue = (
  parameters: ConfigParameters,
  simulation: SimulationResult,
  tokens: BN,
  at: Trade['at'],
): BN => {
  if (tokens.isZero()) return new BN(0)
  if (simulation.migratedPool?.liquidity.isZero()) return new BN(0)
  if (simulation.migratedPool)
    return quoteMigratedSwap(simulation.migratedPool, true, tokens, at).quote
      .outputAmount
  if (simulation.graduatedAt !== null)
    return spotValue(tokens, simulation.finalPool)
  return swapQuotePartialFill(
    simulation.finalPool,
    toPoolConfig(parameters),
    true,
    tokens,
    0,
    false,
    pointAt(at, parameters.activationType),
    false,
  ).outputAmount
}

const BPS_PER_UNIT = 10_000

/**
 * The base fee, in basis points, the program charges a buy of `amountIn` at `at` seconds
 * after activation — read from the SDK's own fee handler, so traders that react to the
 * fee see exactly what the chain would charge.
 */
export const baseFeeBpsAt = (
  parameters: ConfigParameters,
  at: Trade['at'],
  amountIn: BN,
): number => {
  const {
    cliffFeeNumerator,
    firstFactor,
    secondFactor,
    thirdFactor,
    baseFeeMode,
  } = parameters.poolFees.baseFee
  const numerator = getBaseFeeHandler(
    cliffFeeNumerator,
    firstFactor,
    secondFactor,
    thirdFactor,
    baseFeeMode,
  ).getBaseFeeNumeratorFromIncludedFeeAmount(
    pointAt(at, parameters.activationType),
    new BN(0),
    TradeDirection.QuoteToBase,
    amountIn,
  )
  return numerator.muln(BPS_PER_UNIT).div(new BN(FEE_DENOMINATOR)).toNumber()
}
