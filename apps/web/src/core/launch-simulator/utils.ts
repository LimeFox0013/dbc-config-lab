import BN from 'bn.js'
import { PublicKey } from '@solana/web3.js'
import {
  ActivationType,
  getMigrationThresholdPrice,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type {
  ConfigParameters,
  PoolConfig,
  VirtualPool,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { FeeToken, SLOT_DURATION_MS } from './constants'
import type { FeeShares } from './types'

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
  const creator = tradingFee.muln(creatorTradingFeePercentage).divn(100)
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
      ? Math.floor((seconds * 1000) / SLOT_DURATION_MS)
      : seconds,
  )
