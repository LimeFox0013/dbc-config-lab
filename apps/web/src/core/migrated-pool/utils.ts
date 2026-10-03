import BN from 'bn.js'
import { PublicKey } from '@solana/web3.js'
import Decimal from 'decimal.js'
import {
  BaseFeeMode as DammBaseFeeMode,
  bpsToFeeNumerator,
  CollectFeeMode as DammCollectFeeMode,
  cpAmmCoder,
  CURRENT_POOL_VERSION,
  DEAD_LIQUIDITY,
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
import {
  isEnumValue,
  PERCENT,
  PRICE_X128_SHIFT,
  quoteValueAtSqrtPrice,
} from '../shared'
import type { MigratedPool, PulledLiquidity } from './types'

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

const ceilDiv = (numerator: BN, denominator: BN): BN => {
  const { div, mod } = numerator.divmod(denominator)
  return mod.isZero() ? div : div.addn(1)
}

/** The quote the curve hands over at graduation: the threshold less the migration fee. */
const migratedQuoteOf = (
  parameters: ConfigParameters,
  config: PoolConfig,
): BN =>
  new BN(
    getMigrationQuoteAmountFromMigrationQuoteThreshold(
      new Decimal(config.migrationQuoteThreshold.toString()),
      parameters.migrationFee.feePercentage,
    )
      .floor()
      .toFixed(),
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
 * The DAMM v2 pool the DBC program opens at graduation: full price range, priced at the
 * migration price, with liquidity from the migrated quote — the threshold minus the
 * config's migration fee, minus the program's protocol share of what is migrated.
 */
export const toMigratedPool = (
  parameters: ConfigParameters,
  config: PoolConfig,
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
      compoundingFeeBps: compounding ? parameters.compoundingFeeBps : 0,
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

/**
 * Why the post-graduation pool cannot be simulated exactly, or null. The DAMM v2 dynamic
 * fee changes pool state in a way this model does not replay.
 */
export const migratedUnsupportedReason = (
  parameters: ConfigParameters,
): string | null => {
  if (parameters.migrationOption !== MigrationOption.MET_DAMM_V2)
    return 'Only DAMM v2 migration is simulated'
  if (parameters.migratedPoolFee.dynamicFee !== DammV2DynamicFeeMode.Disabled)
    return 'Dynamic fee on the migrated pool is not simulated'
  if (migratedFeeBps(parameters) === null) return 'Unknown migration fee option'
  return null
}
