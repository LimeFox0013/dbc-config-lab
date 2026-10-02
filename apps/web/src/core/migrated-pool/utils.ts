import BN from 'bn.js'
import { PublicKey } from '@solana/web3.js'
import Decimal from 'decimal.js'
import {
  BaseFeeMode as DammBaseFeeMode,
  bpsToFeeNumerator,
  CollectFeeMode as DammCollectFeeMode,
  cpAmmCoder,
  CURRENT_POOL_VERSION,
  MAX_SQRT_PRICE,
  MIN_SQRT_PRICE,
  PoolStatus,
} from '@meteora-ag/cp-amm-sdk'
import {
  ActivationType,
  getInitialLiquidityFromDeltaQuote,
  getMigrationBaseToken,
  getMigrationQuoteAmountFromMigrationQuoteThreshold,
  MAX_BASIS_POINT,
  MigratedCollectFeeMode,
  MigrationFeeOption,
  MigrationOption,
  DammV2DynamicFeeMode,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type {
  ConfigParameters,
  PoolConfig,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import {
  FIXED_MIGRATED_FEE_BPS,
  MIGRATED_PROTOCOL_FEE_PERCENT,
  MIGRATED_REFERRAL_FEE_PERCENT,
  PROTOCOL_LIQUIDITY_MIGRATION_FEE_BPS,
} from './constants'
import { isEnumValue } from '../shared'
import type { MigratedPool } from './types'

const zero = (): BN => new BN(0)

const isMigrationFeeOption = isEnumValue<MigrationFeeOption>(
  Object.values(MigrationFeeOption),
)
const isMigratedCollectFeeMode = isEnumValue<MigratedCollectFeeMode>(
  Object.values(MigratedCollectFeeMode),
)

/** The migrated pool's trading fee; null when the config's option is not one the program defines. */
export const migratedFeeBps = (parameters: ConfigParameters): number | null => {
  const option = parameters.migrationFeeOption
  if (!isMigrationFeeOption(option)) return null
  return option === MigrationFeeOption.Customizable
    ? parameters.migratedPoolFee.poolFeeBps
    : (FIXED_MIGRATED_FEE_BPS[option] ?? null)
}

const COLLECT_FEE_MODE: Record<MigratedCollectFeeMode, DammCollectFeeMode> = {
  [MigratedCollectFeeMode.QuoteToken]: DammCollectFeeMode.OnlyB,
  [MigratedCollectFeeMode.OutputToken]: DammCollectFeeMode.BothToken,
  [MigratedCollectFeeMode.Compounding]: DammCollectFeeMode.Compounding,
}

/** The pool's packed base-fee record: a flat fee, encoded with the SDK's own codec. */
const flatBaseFeeData = (feeBps: number): number[] => [
  ...cpAmmCoder.types.encode('PodAlignedFeeTimeScheduler', {
    cliff_fee_numerator: bpsToFeeNumerator(feeBps),
    base_fee_mode: DammBaseFeeMode.FeeTimeSchedulerLinear,
    padding: [0, 0, 0, 0, 0],
    number_of_period: 0,
    period_frequency: zero(),
    reduction_factor: zero(),
  }),
]

/**
 * The DAMM v2 pool the DBC program opens at graduation: full price range, priced at the
 * migration price, with liquidity from the migrated quote — the threshold minus the
 * config's migration fee, minus the program's protocol share of what is migrated.
 */
export const toMigratedPool = (
  parameters: ConfigParameters,
  config: PoolConfig,
): MigratedPool => {
  const migratedQuote = new BN(
    getMigrationQuoteAmountFromMigrationQuoteThreshold(
      new Decimal(config.migrationQuoteThreshold.toString()),
      parameters.migrationFee.feePercentage,
    )
      .floor()
      .toFixed(),
  )
  const quoteAmount = migratedQuote.sub(
    migratedQuote
      .muln(PROTOCOL_LIQUIDITY_MIGRATION_FEE_BPS)
      .divn(MAX_BASIS_POINT),
  )
  const sqrtPrice = config.migrationSqrtPrice
  const liquidity = getInitialLiquidityFromDeltaQuote(
    quoteAmount,
    MIN_SQRT_PRICE,
    sqrtPrice,
  )
  const baseAmount = getMigrationBaseToken(
    quoteAmount,
    sqrtPrice,
    MigrationOption.MET_DAMM_V2,
  )
  const mode = parameters.migratedPoolFee.collectFeeMode
  const feeBps = migratedFeeBps(parameters)
  if (!isMigratedCollectFeeMode(mode) || feeBps === null)
    throw new Error('Unsupported migrated pool fee settings')
  const collectFeeMode = COLLECT_FEE_MODE[mode]

  return {
    poolFees: {
      baseFee: {
        baseFeeInfo: { data: flatBaseFeeData(feeBps) },
        padding1: zero(),
      },
      protocolFeePercent: MIGRATED_PROTOCOL_FEE_PERCENT,
      padding0: 0,
      referralFeePercent: MIGRATED_REFERRAL_FEE_PERCENT,
      padding1: [0, 0, 0],
      compoundingFeeBps: 0,
      dynamicFee: {
        initialized: 0,
        padding: [0, 0, 0, 0, 0, 0, 0],
        maxVolatilityAccumulator: 0,
        variableFeeControl: 0,
        binStep: 0,
        filterPeriod: 0,
        decayPeriod: 0,
        reductionFactor: 0,
        lastUpdateTimestamp: zero(),
        binStepU128: zero(),
        sqrtPriceReference: zero(),
        volatilityAccumulator: zero(),
        volatilityReference: zero(),
      },
      initSqrtPrice: sqrtPrice,
    },
    tokenAMint: PublicKey.default,
    tokenBMint: PublicKey.default,
    tokenAVault: PublicKey.default,
    tokenBVault: PublicKey.default,
    whitelistedVault: PublicKey.default,
    padding0: new Array(32).fill(0),
    liquidity,
    padding1: zero(),
    protocolAFee: zero(),
    protocolBFee: zero(),
    deadLiquidityFeeCheckpoint: zero(),
    padding2: new Array(8).fill(0),
    sqrtMinPrice: MIN_SQRT_PRICE,
    sqrtMaxPrice: MAX_SQRT_PRICE,
    sqrtPrice,
    activationPoint: zero(),
    activationType: ActivationType.Timestamp,
    poolStatus: PoolStatus.Enable,
    tokenAFlag: 0,
    tokenBFlag: 0,
    collectFeeMode,
    poolType: 0,
    feeVersion: CURRENT_POOL_VERSION,
    padding3: 0,
    feeAPerLiquidity: new Array(32).fill(0),
    feeBPerLiquidity: new Array(32).fill(0),
    permanentLockLiquidity: zero(),
    metrics: {
      totalLpAFee: zero(),
      totalLpBFee: zero(),
      totalProtocolAFee: zero(),
      totalProtocolBFee: zero(),
      padding0: [zero(), zero()],
      totalPosition: zero(),
      padding: zero(),
    },
    creator: PublicKey.default,
    tokenAAmount: baseAmount,
    tokenBAmount: quoteAmount,
    layoutVersion: 0,
    padding4: new Array(7).fill(0),
    padding5: [zero(), zero(), zero()],
    rewardInfos: [],
  }
}

/**
 * Why the post-graduation pool cannot be simulated exactly, or null. Compounding liquidity
 * and the DAMM v2 dynamic fee change pool state in ways this model does not replay.
 */
export const migratedUnsupportedReason = (
  parameters: ConfigParameters,
): string | null => {
  if (parameters.migrationOption !== MigrationOption.MET_DAMM_V2)
    return 'Only DAMM v2 migration is simulated'
  if (
    parameters.migratedPoolFee.collectFeeMode ===
    MigratedCollectFeeMode.Compounding
  )
    return 'Compounding fees on the migrated pool are not simulated'
  if (parameters.migratedPoolFee.dynamicFee !== DammV2DynamicFeeMode.Disabled)
    return 'Dynamic fee on the migrated pool is not simulated'
  if (migratedFeeBps(parameters) === null) return 'Unknown migration fee option'
  return null
}
