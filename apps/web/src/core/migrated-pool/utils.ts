import BN from 'bn.js'
import { PublicKey } from '@solana/web3.js'
import {
  BaseFeeMode as DammBaseFeeMode,
  BIN_STEP_BPS_DEFAULT,
  BIN_STEP_BPS_U128_DEFAULT,
  bpsToFeeNumerator,
  CollectFeeMode as DammCollectFeeMode,
  cpAmmCoder,
  CURRENT_POOL_VERSION,
  DEAD_LIQUIDITY,
  DYNAMIC_FEE_DECAY_PERIOD_DEFAULT,
  DYNAMIC_FEE_FILTER_PERIOD_DEFAULT,
  DYNAMIC_FEE_REDUCTION_FACTOR_DEFAULT,
  DYNAMIC_FEE_ROUNDING_OFFSET,
  DYNAMIC_FEE_SCALING_FACTOR,
  feeNumeratorToBps,
  getFeeMarketCapMinBaseFeeNumerator,
  getAmountsForModifyForCompoundingLiquidity,
  getPoolCreationAmountAFromLiquidityDeltaForCompoundingLiquidity,
  getPoolCreationAmountBFromLiquidityDeltaForCompoundingLiquidity,
  getSqrtPriceFromAmountsForCompoundingLiquidity,
  MAX_SQRT_PRICE,
  getAmountAFromLiquidityDelta,
  getAmountBFromLiquidityDelta,
  MIN_SQRT_PRICE,
  PoolStatus,
  Rounding,
  sqrt,
  U128_MAX,
} from '@meteora-ag/cp-amm-sdk'
import {
  ActivationType,
  DammV2BaseFeeMode,
  getInitialLiquidityFromDeltaQuote,
  getMigrationBaseToken,
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
  MIGRATED_MAX_DYNAMIC_FEE_PERCENT,
  MIGRATED_MAX_VOLATILITY_ACCUMULATOR,
  MIGRATED_PROTOCOL_FEE_PERCENT,
  MIGRATED_SQUARE_VFA_BIN,
  MIGRATED_REFERRAL_FEE_PERCENT,
  PROTOCOL_LIQUIDITY_MIGRATION_FEE_BPS,
} from './constants'
import {
  BPS_SCALE,
  isEnumValue,
  PERCENT,
  PRICE_X128_SHIFT,
  quoteValueAtSqrtPrice,
} from '../shared'
import type {
  MigratedBaseFee,
  MigratedFeeSchedule,
  MigratedPool,
  PulledLiquidity,
} from './types'

const zero = (): BN => new BN(0)

const isMigrationFeeOption = isEnumValue<MigrationFeeOption>(
  Object.values(MigrationFeeOption),
)
const isMarketCapScheduler = (mode: DammV2BaseFeeMode): boolean =>
  mode === DammV2BaseFeeMode.FeeMarketCapSchedulerLinear ||
  mode === DammV2BaseFeeMode.FeeMarketCapSchedulerExponential

const isKnownBaseFeeMode = (mode: DammV2BaseFeeMode): boolean =>
  mode === DammV2BaseFeeMode.FeeTimeSchedulerLinear ||
  mode === DammV2BaseFeeMode.FeeTimeSchedulerExponential ||
  isMarketCapScheduler(mode)
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

/**
 * The pool's packed base-fee record and its lowest fee, encoded with the SDK's own codec as
 * the DBC program builds it (config.rs, build_damm_v2_base_fee_params): a flat fee, or a
 * fee that steps down as the price rises — the config's market-cap schedule.
 */
const migratedBaseFee = (
  parameters: ConfigParameters,
  feeBps: number,
): MigratedBaseFee => {
  const cliffFeeNumerator = bpsToFeeNumerator(feeBps)
  const mode = parameters.migratedPoolBaseFeeMode
  if (!isMarketCapScheduler(mode))
    return {
      data: [
        ...cpAmmCoder.types.encode('PodAlignedFeeTimeScheduler', {
          cliff_fee_numerator: cliffFeeNumerator,
          base_fee_mode: DammBaseFeeMode.FeeTimeSchedulerLinear,
          padding: [0, 0, 0, 0, 0],
          number_of_period: 0,
          period_frequency: zero(),
          reduction_factor: zero(),
        }),
      ],
      minFeeNumerator: cliffFeeNumerator,
    }
  const schedule = parameters.migratedPoolMarketCapFeeSchedulerParams
  const dammMode =
    mode === DammV2BaseFeeMode.FeeMarketCapSchedulerLinear
      ? DammBaseFeeMode.FeeMarketCapSchedulerLinear
      : DammBaseFeeMode.FeeMarketCapSchedulerExponential
  return {
    data: [
      ...cpAmmCoder.types.encode('PodAlignedFeeMarketCapScheduler', {
        cliff_fee_numerator: cliffFeeNumerator,
        base_fee_mode: dammMode,
        padding: [0, 0, 0, 0, 0],
        number_of_period: schedule.numberOfPeriod,
        sqrt_price_step_bps: schedule.sqrtPriceStepBps,
        scheduler_expiration_duration: schedule.schedulerExpirationDuration,
        reduction_factor: schedule.reductionFactor,
      }),
    ],
    minFeeNumerator: getFeeMarketCapMinBaseFeeNumerator(
      cliffFeeNumerator,
      schedule.numberOfPeriod,
      schedule.reductionFactor,
      dammMode,
    ),
  }
}

/**
 * The graduated pool's falling fee, or null for a flat one. Its price steps are in sqrt
 * price (each `sqrtPriceStepBps` above the graduation price), so the price multiple at the
 * last step is the square of the sqrt-price multiple.
 */
export const migratedFeeSchedule = (
  parameters: ConfigParameters,
): MigratedFeeSchedule | null => {
  const feeBps = migratedFeeBps(parameters)
  if (
    feeBps === null ||
    !isMarketCapScheduler(parameters.migratedPoolBaseFeeMode)
  )
    return null
  const schedule = parameters.migratedPoolMarketCapFeeSchedulerParams
  const sqrtMultiple =
    1 + (schedule.numberOfPeriod * schedule.sqrtPriceStepBps) / BPS_SCALE
  return {
    exponential:
      parameters.migratedPoolBaseFeeMode ===
      DammV2BaseFeeMode.FeeMarketCapSchedulerExponential,
    endingFeeBps: feeNumeratorToBps(
      migratedBaseFee(parameters, feeBps).minFeeNumerator,
    ),
    steps: schedule.numberOfPeriod,
    priceMultiple: sqrtMultiple ** 2,
    durationSeconds: schedule.schedulerExpirationDuration,
  }
}

/**
 * The pool's dynamic fee: off, or on with the settings the DBC program derives from the
 * lowest base fee (damm_v2_utils.rs, calculate_dynamic_fee_params). The tracker starts empty.
 */
const migratedDynamicFee = (
  parameters: ConfigParameters,
  minFeeNumerator: BN,
): MigratedPool['poolFees']['dynamicFee'] => {
  const tracker = {
    padding: [0, 0, 0, 0, 0, 0, 0],
    lastUpdateTimestamp: zero(),
    sqrtPriceReference: zero(),
    volatilityAccumulator: zero(),
    volatilityReference: zero(),
  }
  if (parameters.migratedPoolFee.dynamicFee !== DammV2DynamicFeeMode.Enabled)
    return {
      ...tracker,
      initialized: 0,
      maxVolatilityAccumulator: 0,
      variableFeeControl: 0,
      binStep: 0,
      filterPeriod: 0,
      decayPeriod: 0,
      reductionFactor: 0,
      binStepU128: zero(),
    }
  return {
    ...tracker,
    initialized: 1,
    maxVolatilityAccumulator: MIGRATED_MAX_VOLATILITY_ACCUMULATOR,
    variableFeeControl: minFeeNumerator
      .muln(MIGRATED_MAX_DYNAMIC_FEE_PERCENT)
      .divn(PERCENT)
      .mul(DYNAMIC_FEE_SCALING_FACTOR)
      .sub(DYNAMIC_FEE_ROUNDING_OFFSET)
      .div(new BN(MIGRATED_SQUARE_VFA_BIN))
      .toNumber(),
    binStep: BIN_STEP_BPS_DEFAULT,
    filterPeriod: DYNAMIC_FEE_FILTER_PERIOD_DEFAULT,
    decayPeriod: DYNAMIC_FEE_DECAY_PERIOD_DEFAULT,
    reductionFactor: DYNAMIC_FEE_REDUCTION_FACTOR_DEFAULT,
    binStepU128: BIN_STEP_BPS_U128_DEFAULT,
  }
}

const ceilDiv = (numerator: BN, denominator: BN): BN => {
  const { div, mod } = numerator.divmod(denominator)
  return mod.isZero() ? div : div.addn(1)
}

/**
 * The quote the curve hands over at graduation: the threshold less the migration fee, the
 * kept share rounded up as the program rounds it (config.rs, get_migration_quote_amount).
 */
const migratedQuoteOf = (
  parameters: ConfigParameters,
  config: PoolConfig,
): BN =>
  ceilDiv(
    config.migrationQuoteThreshold.muln(
      PERCENT - parameters.migrationFee.feePercentage,
    ),
    new BN(PERCENT),
  )

/** The program's protocol share of a migrated amount, rounded down. */
const protocolShare = (amount: BN): BN =>
  amount.muln(PROTOCOL_LIQUIDITY_MIGRATION_FEE_BPS).divn(MAX_BASIS_POINT)

/** Partner's and creator's shares of `liquidity`, split and rounded as the program splits them. */
const liquidityShares = (
  parameters: ConfigParameters,
  liquidity: BN,
): { partner: BN; creator: BN } => {
  const share = (percentage: number): BN =>
    liquidity.muln(percentage).divn(PERCENT)
  const partner = share(parameters.partnerLiquidityPercentage)
    .add(share(parameters.partnerPermanentLockedLiquidityPercentage))
    .add(share(parameters.partnerLiquidityVestingInfo.vestingPercentage))
  return { partner, creator: liquidity.sub(partner) }
}

/** The reserves, liquidity and price of a compounding pool. */
interface CompoundingState {
  tokenAAmount: BN
  tokenBAmount: BN
  liquidity: BN
  sqrtPrice: BN
}

/**
 * The compounding (constant-product) DAMM v2 pool the DBC program opens at graduation
 * (migration_handler/compounding_liquidity.rs and migrate_damm_v2_initialize_pool.rs):
 * the base for the migrated quote at the migration price, both less the program's protocol
 * share; a pool opened with the larger of partner's and creator's liquidity plus the locked
 * dead liquidity; then the other share added from what is left.
 */
const compoundingMigratedState = (
  parameters: ConfigParameters,
  config: PoolConfig,
): CompoundingState => {
  const quoteThreshold = migratedQuoteOf(parameters, config)
  const migrationPriceX128 = config.migrationSqrtPrice.mul(
    config.migrationSqrtPrice,
  )
  const baseThreshold = ceilDiv(
    quoteThreshold.shln(PRICE_X128_SHIFT),
    migrationPriceX128,
  )
  const base = baseThreshold.sub(protocolShare(baseThreshold))
  const quote = quoteThreshold.sub(protocolShare(quoteThreshold))

  const sqrtPrice = sqrt(ceilDiv(quote.shln(PRICE_X128_SHIFT), base))
  const totalLiquidity = sqrt(quote.shln(PRICE_X128_SHIFT).div(base)).mul(base)
  const { partner, creator } = liquidityShares(
    parameters,
    totalLiquidity.sub(DEAD_LIQUIDITY),
  )
  const first = (partner.gt(creator) ? partner : creator).add(DEAD_LIQUIDITY)
  const tokenA =
    getPoolCreationAmountAFromLiquidityDeltaForCompoundingLiquidity(
      sqrtPrice,
      first,
    )
  const tokenB =
    getPoolCreationAmountBFromLiquidityDeltaForCompoundingLiquidity(
      sqrtPrice,
      first,
    )
  const second = BN.min(
    base.sub(tokenA).mul(first).div(tokenA),
    quote.sub(tokenB).mul(first).div(tokenB),
  )
  const [addedA, addedB] = getAmountsForModifyForCompoundingLiquidity(
    tokenA,
    tokenB,
    first,
    second,
    Rounding.Up,
  )
  return {
    tokenAAmount: tokenA.add(addedA),
    tokenBAmount: tokenB.add(addedB),
    liquidity: first.add(second),
    sqrtPrice: getSqrtPriceFromAmountsForCompoundingLiquidity(
      tokenA.add(addedA),
      tokenB.add(addedB),
    ),
  }
}

/** The full-range concentrated pool the DBC program opens for the other fee modes. */
const concentratedMigratedState = (
  parameters: ConfigParameters,
  config: PoolConfig,
): CompoundingState => {
  const migratedQuote = migratedQuoteOf(parameters, config)
  const quoteAmount = migratedQuote.sub(protocolShare(migratedQuote))
  const sqrtPrice = config.migrationSqrtPrice
  return {
    liquidity: getInitialLiquidityFromDeltaQuote(
      quoteAmount,
      MIN_SQRT_PRICE,
      sqrtPrice,
    ),
    sqrtPrice,
    tokenAAmount: getMigrationBaseToken(
      quoteAmount,
      sqrtPrice,
      MigrationOption.MET_DAMM_V2,
    ),
    tokenBAmount: quoteAmount,
  }
}

/**
 * The DAMM v2 pool the DBC program opens at graduation (`openedAt`, unix seconds): full
 * price range, priced at the migration price, with liquidity from the migrated quote — the
 * threshold minus the config's migration fee, minus the program's protocol share of what is
 * migrated.
 */
export const toMigratedPool = (
  parameters: ConfigParameters,
  config: PoolConfig,
  openedAt: BN,
): MigratedPool => {
  const mode = parameters.migratedPoolFee.collectFeeMode
  const feeBps = migratedFeeBps(parameters)
  if (!isMigratedCollectFeeMode(mode) || feeBps === null)
    throw new Error('Unsupported migrated pool fee settings')
  const collectFeeMode = COLLECT_FEE_MODE[mode]
  const compounding = mode === MigratedCollectFeeMode.Compounding
  const opened = compounding
    ? compoundingMigratedState(parameters, config)
    : concentratedMigratedState(parameters, config)
  const baseFee = migratedBaseFee(parameters, feeBps)

  return {
    poolFees: {
      baseFee: {
        baseFeeInfo: { data: baseFee.data },
        padding1: zero(),
      },
      protocolFeePercent: MIGRATED_PROTOCOL_FEE_PERCENT,
      padding0: 0,
      referralFeePercent: MIGRATED_REFERRAL_FEE_PERCENT,
      padding1: [0, 0, 0],
      compoundingFeeBps: compounding ? parameters.compoundingFeeBps : 0,
      dynamicFee: migratedDynamicFee(parameters, baseFee.minFeeNumerator),
      initSqrtPrice: opened.sqrtPrice,
    },
    tokenAMint: PublicKey.default,
    tokenBMint: PublicKey.default,
    tokenAVault: PublicKey.default,
    tokenBVault: PublicKey.default,
    whitelistedVault: PublicKey.default,
    padding0: new Array(32).fill(0),
    liquidity: opened.liquidity,
    padding1: zero(),
    protocolAFee: zero(),
    protocolBFee: zero(),
    deadLiquidityFeeCheckpoint: zero(),
    padding2: new Array(8).fill(0),
    // A compounding pool has no price range: the SDK's own initial pool uses 0..U128_MAX.
    sqrtMinPrice: compounding ? zero() : MIN_SQRT_PRICE,
    sqrtMaxPrice: compounding ? U128_MAX : MAX_SQRT_PRICE,
    sqrtPrice: opened.sqrtPrice,
    activationPoint: openedAt,
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
    tokenAAmount: opened.tokenAAmount,
    tokenBAmount: opened.tokenBAmount,
    layoutVersion: 0,
    padding4: new Array(7).fill(0),
    padding5: [zero(), zero(), zero()],
    rewardInfos: [],
  }
}

/**
 * The part of the migrated pool's liquidity nobody can withdraw at graduation: the
 * permanently locked and vesting shares of partner and creator, each rounded down as the
 * program splits it (config.rs, get_liquidity_distribution), plus — in a compounding pool —
 * the dead liquidity locked at creation. Vesting liquidity unlocks after its cliff, which
 * is later than any scenario runs.
 */
export const lockedLiquidity = (
  parameters: ConfigParameters,
  liquidity: BN,
  compounding = false,
): BN => {
  const distributable = compounding ? liquidity.sub(DEAD_LIQUIDITY) : liquidity
  return [
    parameters.partnerPermanentLockedLiquidityPercentage,
    parameters.creatorPermanentLockedLiquidityPercentage,
    parameters.partnerLiquidityVestingInfo.vestingPercentage,
    parameters.creatorLiquidityVestingInfo.vestingPercentage,
  ].reduce(
    (total, percentage) =>
      total.add(distributable.muln(percentage).divn(PERCENT)),
    compounding ? DEAD_LIQUIDITY : zero(),
  )
}

/** Percent of the graduation pool's liquidity that is neither locked nor vesting. */
export const pullableLiquidityPercent = (
  parameters: ConfigParameters,
): number =>
  parameters.partnerLiquidityPercentage + parameters.creatorLiquidityPercentage

/**
 * Withdraws everything not locked or vesting: the pool left behind, and what the withdrawal
 * returns — rounded down as the program rounds a removal.
 */
export const withUnlockedLiquidityPulled = (
  parameters: ConfigParameters,
  pool: MigratedPool,
): { pool: MigratedPool; pulled: PulledLiquidity } => {
  const compounding = pool.collectFeeMode === DammCollectFeeMode.Compounding
  const kept = lockedLiquidity(parameters, pool.liquidity, compounding)
  const delta = pool.liquidity.sub(kept)
  // A compounding pool pays out its reserves pro rata; a concentrated one along its range.
  const [base, quote] = compounding
    ? getAmountsForModifyForCompoundingLiquidity(
        pool.tokenAAmount,
        pool.tokenBAmount,
        pool.liquidity,
        delta,
        Rounding.Down,
      )
    : [
        getAmountAFromLiquidityDelta(
          pool.sqrtPrice,
          pool.sqrtMaxPrice,
          delta,
          Rounding.Down,
          pool.collectFeeMode,
        ),
        getAmountBFromLiquidityDelta(
          pool.sqrtMinPrice,
          pool.sqrtPrice,
          delta,
          Rounding.Down,
          pool.collectFeeMode,
        ),
      ]
  const baseValue = quoteValueAtSqrtPrice(base, pool.sqrtPrice)
  return {
    pool: {
      ...pool,
      liquidity: kept,
      ...(compounding
        ? {
            tokenAAmount: pool.tokenAAmount.sub(base),
            tokenBAmount: pool.tokenBAmount.sub(quote),
          }
        : {}),
    },
    pulled: { base, quote, value: quote.add(baseValue) },
  }
}

/** Why the post-graduation pool cannot be simulated exactly, or null. */
export const migratedUnsupportedReason = (
  parameters: ConfigParameters,
): string | null => {
  if (parameters.migrationOption !== MigrationOption.MET_DAMM_V2)
    return 'Only DAMM v2 migration is simulated'
  if (!isKnownBaseFeeMode(parameters.migratedPoolBaseFeeMode))
    return 'Unknown graduated pool fee schedule'
  if (migratedFeeBps(parameters) === null) return 'Unknown migration fee option'
  return null
}
