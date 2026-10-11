import BN from 'bn.js'
import type {
  ConfigParameters,
  PoolConfig,
} from '@meteora-ag/dynamic-bonding-curve-sdk'

import { MARKET_CAP_SCHEDULER_LAYOUT } from './constants'

type VestingInfo = PoolConfig['partnerLiquidityVestingInfo']

/** The graduated pool's market-cap fee schedule, unpacked from the bytes the config stores it as. */
const marketCapScheduler = (
  bytes: number[],
): ConfigParameters['migratedPoolMarketCapFeeSchedulerParams'] => {
  const view = new DataView(Uint8Array.from(bytes).buffer)
  return {
    numberOfPeriod: view.getUint16(
      MARKET_CAP_SCHEDULER_LAYOUT.numberOfPeriod,
      true,
    ),
    sqrtPriceStepBps: view.getUint16(
      MARKET_CAP_SCHEDULER_LAYOUT.sqrtPriceStepBps,
      true,
    ),
    schedulerExpirationDuration: view.getUint32(
      MARKET_CAP_SCHEDULER_LAYOUT.schedulerExpirationDuration,
      true,
    ),
    reductionFactor: new BN(
      view
        .getBigUint64(MARKET_CAP_SCHEDULER_LAYOUT.reductionFactor, true)
        .toString(),
    ),
  }
}

const vestingParams = (
  info: VestingInfo,
): ConfigParameters['partnerLiquidityVestingInfo'] => ({
  vestingPercentage: info.vestingPercentage,
  bpsPerPeriod: info.bpsPerPeriod,
  numberOfPeriods: info.numberOfPeriods,
  cliffDurationFromMigrationTime: info.cliffDurationFromMigrationTime,
  frequency: info.frequency,
})

/** A stored curve is a fixed array padded with empty points; the parameters list only real ones. */
const curvePoints = (config: PoolConfig): ConfigParameters['curve'] =>
  config.curve
    .filter((point) => !point.sqrtPrice.isZero())
    .map((point) => ({
      sqrtPrice: point.sqrtPrice,
      liquidity: point.liquidity,
    }))

/**
 * The config parameters an on-chain PoolConfig account was created from, as far as the
 * simulator reads them.
 */
export const fromPoolConfig = (config: PoolConfig): ConfigParameters => ({
  poolFees: {
    baseFee: {
      cliffFeeNumerator: config.poolFees.baseFee.cliffFeeNumerator,
      firstFactor: config.poolFees.baseFee.firstFactor,
      secondFactor: config.poolFees.baseFee.secondFactor,
      thirdFactor: config.poolFees.baseFee.thirdFactor,
      baseFeeMode: config.poolFees.baseFee.baseFeeMode,
    },
    dynamicFee: config.poolFees.dynamicFee.initialized
      ? {
          binStep: config.poolFees.dynamicFee.binStep,
          binStepU128: config.poolFees.dynamicFee.binStepU128,
          filterPeriod: config.poolFees.dynamicFee.filterPeriod,
          decayPeriod: config.poolFees.dynamicFee.decayPeriod,
          reductionFactor: config.poolFees.dynamicFee.reductionFactor,
          maxVolatilityAccumulator:
            config.poolFees.dynamicFee.maxVolatilityAccumulator,
          variableFeeControl: config.poolFees.dynamicFee.variableFeeControl,
        }
      : null,
  },
  collectFeeMode: config.collectFeeMode,
  migrationOption: config.migrationOption,
  activationType: config.activationType,
  tokenType: config.tokenType,
  tokenDecimal: config.tokenDecimal,
  partnerLiquidityPercentage: config.partnerLiquidityPercentage,
  partnerPermanentLockedLiquidityPercentage:
    config.partnerPermanentLockedLiquidityPercentage,
  creatorLiquidityPercentage: config.creatorLiquidityPercentage,
  creatorPermanentLockedLiquidityPercentage:
    config.creatorPermanentLockedLiquidityPercentage,
  migrationQuoteThreshold: config.migrationQuoteThreshold,
  sqrtStartPrice: config.sqrtStartPrice,
  lockedVesting: {
    amountPerPeriod: config.lockedVestingConfig.amountPerPeriod,
    cliffDurationFromMigrationTime:
      config.lockedVestingConfig.cliffDurationFromMigrationTime,
    frequency: config.lockedVestingConfig.frequency,
    numberOfPeriod: config.lockedVestingConfig.numberOfPeriod,
    cliffUnlockAmount: config.lockedVestingConfig.cliffUnlockAmount,
  },
  migrationFeeOption: config.migrationFeeOption,
  tokenSupply: config.fixedTokenSupplyFlag
    ? {
        preMigrationTokenSupply: config.preMigrationTokenSupply,
        postMigrationTokenSupply: config.postMigrationTokenSupply,
      }
    : null,
  creatorTradingFeePercentage: config.creatorTradingFeePercentage,
  tokenUpdateAuthority: config.tokenUpdateAuthority,
  migrationFee: {
    feePercentage: config.migrationFeePercentage,
    creatorFeePercentage: config.creatorMigrationFeePercentage,
  },
  migratedPoolFee: {
    collectFeeMode: config.migratedCollectFeeMode,
    dynamicFee: config.migratedDynamicFee,
    poolFeeBps: config.migratedPoolFeeBps,
  },
  poolCreationFee: config.poolCreationFee,
  partnerLiquidityVestingInfo: vestingParams(
    config.partnerLiquidityVestingInfo,
  ),
  creatorLiquidityVestingInfo: vestingParams(
    config.creatorLiquidityVestingInfo,
  ),
  migratedPoolBaseFeeMode: config.migratedPoolBaseFeeMode,
  migratedPoolMarketCapFeeSchedulerParams: marketCapScheduler(
    config.migratedPoolBaseFeeBytes,
  ),
  enableFirstSwapWithMinFee: config.enableFirstSwapWithMinFee !== 0,
  compoundingFeeBps: config.migratedCompoundingFeeBps,
  padding: [0, 0],
  curve: curvePoints(config),
})
