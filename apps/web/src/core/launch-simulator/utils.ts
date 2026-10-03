import BN from 'bn.js'
import { PublicKey } from '@solana/web3.js'
import {
  ActivationType,
  getMigrationThresholdPrice,
  MAX_BASIS_POINT,
  ONE_Q64,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type {
  ConfigParameters,
  DynamicFeeConfig,
  PoolConfig,
  SwapQuote2Result,
  VirtualPool,
  VolatilityTracker,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import {
  FeeToken,
  MS_PER_SECOND,
  Q64_SHIFT,
  SIMULATED_ACTIVATION_TIMESTAMP,
  SLOT_DURATION_MS,
} from './constants'
import type { FeeShares } from './types'
import { PERCENT } from '../shared'

const zero = (): BN => new BN(0)

export const emptyFeeShares = (): FeeShares => ({
  partner: zero(),
  creator: zero(),
  protocol: zero(),
  referral: zero(),
})

export const addFeeShares = (a: FeeShares, b: FeeShares): FeeShares => ({
  partner: a.partner.add(b.partner),
  creator: a.creator.add(b.creator),
  protocol: a.protocol.add(b.protocol),
  referral: a.referral.add(b.referral),
})

/** Quote reserve after a swap, following the program's accounting for each fee mode. */
export const nextQuoteReserve = (
  pool: VirtualPool,
  quote: SwapQuote2Result,
  isBuy: boolean,
  feesOnInput: boolean,
): BN => {
  const reserve = pool.poolState.quoteReserve
  if (isBuy) {
    return reserve.add(
      feesOnInput ? quote.excludedFeeInputAmount : quote.includedFeeInputAmount,
    )
  }
  const totalFee = quote.tradingFee
    .add(quote.protocolFee)
    .add(quote.referralFee)
  return reserve.sub(
    feesOnInput ? quote.outputAmount : quote.outputAmount.add(totalFee),
  )
}

export const feeTotal = (shares: FeeShares): BN =>
  shares.partner.add(shares.creator).add(shares.protocol).add(shares.referral)

const scaleFeeShares = (
  shares: FeeShares,
  numerator: BN,
  denominator: BN,
): FeeShares =>
  denominator.lten(0)
    ? emptyFeeShares()
    : {
        partner: shares.partner.mul(numerator).div(denominator),
        creator: shares.creator.mul(numerator).div(denominator),
        protocol: shares.protocol.mul(numerator).div(denominator),
        referral: shares.referral.mul(numerator).div(denominator),
      }

/**
 * A trade's fee in quote lamports. A fee taken in the base token is valued at the trade's
 * own average price, fee excluded, so fees in either token add up in one unit.
 */
export const feeValueInQuote = (
  fee: FeeShares,
  feeToken: FeeToken,
  isBuy: boolean,
  amountInUsed: BN,
  amountOut: BN,
): FeeShares => {
  if (feeToken === FeeToken.Quote) return fee
  const total = feeTotal(fee)
  return isBuy
    ? scaleFeeShares(fee, amountInUsed, amountOut.add(total))
    : scaleFeeShares(fee, amountOut, amountInUsed.sub(total))
}

/** Splits the trading fee (protocol share already removed) between creator and partner. */
export const splitTradingFee = (
  tradingFee: BN,
  protocolFee: BN,
  referralFee: BN,
  creatorTradingFeePercentage: number,
): FeeShares => {
  const creator = tradingFee.muln(creatorTradingFeePercentage).divn(PERCENT)
  return {
    partner: tradingFee.sub(creator),
    creator,
    protocol: protocolFee,
    referral: referralFee,
  }
}

/** The PoolConfig account the program would store for these parameters. */
export const toPoolConfig = (parameters: ConfigParameters): PoolConfig => {
  const dynamicFee = parameters.poolFees.dynamicFee
  return {
    quoteMint: PublicKey.default,
    feeClaimer: PublicKey.default,
    leftoverReceiver: PublicKey.default,
    poolFees: {
      baseFee: { ...parameters.poolFees.baseFee, padding0: [0, 0, 0, 0, 0] },
      dynamicFee: {
        initialized: dynamicFee ? 1 : 0,
        padding: [0, 0, 0, 0, 0, 0, 0],
        maxVolatilityAccumulator: dynamicFee?.maxVolatilityAccumulator ?? 0,
        variableFeeControl: dynamicFee?.variableFeeControl ?? 0,
        binStep: dynamicFee?.binStep ?? 0,
        filterPeriod: dynamicFee?.filterPeriod ?? 0,
        decayPeriod: dynamicFee?.decayPeriod ?? 0,
        reductionFactor: dynamicFee?.reductionFactor ?? 0,
        padding2: [0, 0, 0, 0, 0, 0, 0, 0],
        binStepU128: dynamicFee?.binStepU128 ?? zero(),
      },
    },
    partnerLiquidityVestingInfo: inactiveVesting(),
    creatorLiquidityVestingInfo: inactiveVesting(),
    padding0: new Array(14).fill(0),
    padding1: 0,
    collectFeeMode: parameters.collectFeeMode,
    migrationOption: parameters.migrationOption,
    activationType: parameters.activationType,
    tokenDecimal: parameters.tokenDecimal,
    version: 0,
    tokenType: parameters.tokenType,
    quoteTokenFlag: 0,
    partnerPermanentLockedLiquidityPercentage:
      parameters.partnerPermanentLockedLiquidityPercentage,
    partnerLiquidityPercentage: parameters.partnerLiquidityPercentage,
    creatorPermanentLockedLiquidityPercentage:
      parameters.creatorPermanentLockedLiquidityPercentage,
    creatorLiquidityPercentage: parameters.creatorLiquidityPercentage,
    migrationFeeOption: parameters.migrationFeeOption,
    fixedTokenSupplyFlag: parameters.tokenSupply ? 1 : 0,
    creatorTradingFeePercentage: parameters.creatorTradingFeePercentage,
    tokenUpdateAuthority: parameters.tokenUpdateAuthority,
    migrationFeePercentage: parameters.migrationFee.feePercentage,
    creatorMigrationFeePercentage: parameters.migrationFee.creatorFeePercentage,
    padding2: [0, 0, 0, 0, 0, 0, 0],
    swapBaseAmount: zero(),
    migrationQuoteThreshold: parameters.migrationQuoteThreshold,
    migrationBaseThreshold: zero(),
    migrationSqrtPrice: getMigrationThresholdPrice(
      parameters.migrationQuoteThreshold,
      parameters.sqrtStartPrice,
      parameters.curve,
    ),
    lockedVestingConfig: {
      amountPerPeriod: zero(),
      cliffDurationFromMigrationTime: zero(),
      frequency: zero(),
      numberOfPeriod: zero(),
      cliffUnlockAmount: zero(),
      padding: zero(),
    },
    preMigrationTokenSupply:
      parameters.tokenSupply?.preMigrationTokenSupply ?? zero(),
    postMigrationTokenSupply:
      parameters.tokenSupply?.postMigrationTokenSupply ?? zero(),
    migratedCollectFeeMode: parameters.migratedPoolFee.collectFeeMode,
    migratedDynamicFee: parameters.migratedPoolFee.dynamicFee,
    migratedPoolFeeBps: parameters.migratedPoolFee.poolFeeBps,
    migratedPoolBaseFeeMode: parameters.migratedPoolBaseFeeMode,
    enableFirstSwapWithMinFee: parameters.enableFirstSwapWithMinFee ? 1 : 0,
    migratedCompoundingFeeBps: parameters.compoundingFeeBps,
    poolCreationFee: parameters.poolCreationFee,
    migratedPoolBaseFeeBytes: new Array(16).fill(0),
    sqrtStartPrice: parameters.sqrtStartPrice,
    curve: parameters.curve,
  }
}

const inactiveVesting = () => ({
  isInitialized: 0,
  vestingPercentage: 0,
  padding: [0, 0],
  bpsPerPeriod: 0,
  numberOfPeriods: 0,
  frequency: 0,
  cliffDurationFromMigrationTime: 0,
})

/** A freshly created virtual pool: full base reserve, no quote, priced at the curve start. */
export const toInitialPool = (parameters: ConfigParameters): VirtualPool => ({
  poolState: {
    volatilityTracker: {
      lastUpdateTimestamp: zero(),
      padding: [0, 0, 0, 0, 0, 0, 0, 0],
      sqrtPriceReference: zero(),
      volatilityAccumulator: zero(),
      volatilityReference: zero(),
    },
    config: PublicKey.default,
    creator: PublicKey.default,
    baseMint: PublicKey.default,
    baseVault: PublicKey.default,
    quoteVault: PublicKey.default,
    baseReserve: zero(),
    quoteReserve: zero(),
    protocolBaseFee: zero(),
    protocolQuoteFee: zero(),
    partnerBaseFee: zero(),
    partnerQuoteFee: zero(),
    sqrtPrice: parameters.sqrtStartPrice,
    activationPoint: zero(),
    poolType: 0,
    isMigrated: 0,
    isPartnerWithdrawSurplus: 0,
    isProtocolWithdrawSurplus: 0,
    migrationProgress: 0,
    isWithdrawLeftover: 0,
    isCreatorWithdrawSurplus: 0,
    migrationFeeWithdrawStatus: 0,
    metrics: {
      totalProtocolBaseFee: zero(),
      totalProtocolQuoteFee: zero(),
      totalTradingBaseFee: zero(),
      totalTradingQuoteFee: zero(),
    },
    finishCurveTimestamp: zero(),
    creatorBaseFee: zero(),
    creatorQuoteFee: zero(),
    legacyCreationFeeBits: 0,
    creationFeeBits: 0,
    hasSwap: 0,
    padding0: [0, 0, 0, 0, 0],
    protocolLiquidityMigrationFeeBps: 0,
    padding1: [0, 0, 0, 0, 0, 0],
    protocolMigrationBaseFeeAmount: zero(),
    protocolMigrationQuoteFeeAmount: zero(),
    padding2: [zero(), zero(), zero()],
  },
})

/** The program's clock value `seconds` after activation: seconds, or slots for slot-activated configs. */
export const pointAt = (seconds: number, activationType: number): BN =>
  new BN(
    activationType === ActivationType.Slot
      ? Math.floor((seconds * MS_PER_SECOND) / SLOT_DURATION_MS)
      : seconds,
  )

/** The program clock, in unix seconds, `seconds` after the simulated pool activated. */
export const timestampAt = (seconds: number): BN =>
  new BN(SIMULATED_ACTIVATION_TIMESTAMP + seconds)

/*
 * The DBC program's volatility tracker (state/fee.rs, VolatilityTracker; virtual_pool.rs,
 * update_pre_swap / update_post_swap), ported so the dynamic fee can be replayed: the SDK
 * quotes from the stored tracker but does not advance it between swaps.
 */

/** Bins crossed between two sqrt prices, as the program counts them (times two, rounded down). */
export const deltaBinId = (
  binStepU128: BN,
  sqrtPriceA: BN,
  sqrtPriceB: BN,
): BN => {
  const [upper, lower] = sqrtPriceA.gt(sqrtPriceB)
    ? [sqrtPriceA, sqrtPriceB]
    : [sqrtPriceB, sqrtPriceA]
  return upper.shln(Q64_SHIFT).div(lower).sub(ONE_Q64).div(binStepU128).muln(2)
}

/** Before a swap: refreshes the price reference and decays the volatility once trading pauses. */
export const trackerBeforeSwap = (
  tracker: VolatilityTracker,
  dynamicFee: DynamicFeeConfig,
  sqrtPrice: BN,
  timestamp: BN,
): VolatilityTracker => {
  const elapsed = BN.max(timestamp.sub(tracker.lastUpdateTimestamp), new BN(0))
  if (elapsed.ltn(dynamicFee.filterPeriod)) return tracker
  return {
    ...tracker,
    sqrtPriceReference: sqrtPrice,
    volatilityReference: elapsed.ltn(dynamicFee.decayPeriod)
      ? tracker.volatilityAccumulator
          .muln(dynamicFee.reductionFactor)
          .divn(MAX_BASIS_POINT)
      : new BN(0),
  }
}

/** After a swap: accumulates the move from the reference price, stamped only if a bin was crossed. */
export const trackerAfterSwap = (
  tracker: VolatilityTracker,
  dynamicFee: DynamicFeeConfig,
  sqrtPriceBefore: BN,
  sqrtPriceAfter: BN,
  timestamp: BN,
): VolatilityTracker => {
  const accumulated = tracker.volatilityReference.add(
    deltaBinId(
      dynamicFee.binStepU128,
      sqrtPriceAfter,
      tracker.sqrtPriceReference,
    ).muln(MAX_BASIS_POINT),
  )
  return {
    ...tracker,
    volatilityAccumulator: BN.min(
      accumulated,
      new BN(dynamicFee.maxVolatilityAccumulator),
    ),
    lastUpdateTimestamp: deltaBinId(
      dynamicFee.binStepU128,
      sqrtPriceBefore,
      sqrtPriceAfter,
    ).isZero()
      ? tracker.lastUpdateTimestamp
      : timestamp,
  }
}

/** Base units the config vests to the creator: the cliff unlock plus every period's release. */
export const lockedVestingAmount = (parameters: ConfigParameters): BN => {
  const { cliffUnlockAmount, amountPerPeriod, numberOfPeriod } =
    parameters.lockedVesting
  return cliffUnlockAmount.add(amountPerPeriod.mul(numberOfPeriod))
}
