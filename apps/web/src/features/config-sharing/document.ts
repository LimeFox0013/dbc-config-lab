import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  DammV2BaseFeeMode,
  DammV2DynamicFeeMode,
  MigratedCollectFeeMode,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type {
  BaseFeeParams,
  BuildCurveBaseParams,
  LiquidityVestingInfoParams,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { CurveShape, LIQUIDITY_WEIGHT_SEGMENTS } from '../../core/launch-config'
import type { CurveSpec, LaunchConfig } from '../../core/launch-config'
import { QUOTE_TOKEN_ORDER, QuoteToken } from '../../core/quote-token'
import {
  arrayOf,
  boolean,
  finiteNumber,
  oneOf,
  optional,
  ReadError,
  record,
} from './readers'
import type { Reader } from './types'

const TOKEN_TYPES = [TokenType.SPLToken, TokenType.Token2022]
const TOKEN_DECIMALS = [
  TokenDecimal.SIX,
  TokenDecimal.SEVEN,
  TokenDecimal.EIGHT,
  TokenDecimal.NINE,
]
const TOKEN_AUTHORITIES = [
  TokenAuthorityOption.CreatorUpdateAuthority,
  TokenAuthorityOption.Immutable,
  TokenAuthorityOption.PartnerUpdateAuthority,
  TokenAuthorityOption.CreatorUpdateAndMintAuthority,
  TokenAuthorityOption.PartnerUpdateAndMintAuthority,
]
const SCHEDULER_MODES = [
  BaseFeeMode.FeeSchedulerLinear,
  BaseFeeMode.FeeSchedulerExponential,
] as const
const COLLECT_FEE_MODES = [
  CollectFeeMode.QuoteToken,
  CollectFeeMode.OutputToken,
]
const MIGRATION_OPTIONS = [
  MigrationOption.MET_DAMM,
  MigrationOption.MET_DAMM_V2,
]
const MIGRATION_FEE_OPTIONS = [
  MigrationFeeOption.FixedBps25,
  MigrationFeeOption.FixedBps30,
  MigrationFeeOption.FixedBps100,
  MigrationFeeOption.FixedBps200,
  MigrationFeeOption.FixedBps400,
  MigrationFeeOption.FixedBps600,
  MigrationFeeOption.Customizable,
]
const MIGRATED_COLLECT_FEE_MODES = [
  MigratedCollectFeeMode.QuoteToken,
  MigratedCollectFeeMode.OutputToken,
  MigratedCollectFeeMode.Compounding,
]
const DAMM_DYNAMIC_FEE_MODES = [
  DammV2DynamicFeeMode.Disabled,
  DammV2DynamicFeeMode.Enabled,
]
const DAMM_BASE_FEE_MODES = [
  DammV2BaseFeeMode.FeeTimeSchedulerLinear,
  DammV2BaseFeeMode.FeeTimeSchedulerExponential,
  DammV2BaseFeeMode.RateLimiter,
  DammV2BaseFeeMode.FeeMarketCapSchedulerLinear,
  DammV2BaseFeeMode.FeeMarketCapSchedulerExponential,
]
const ACTIVATION_TYPES = [ActivationType.Slot, ActivationType.Timestamp]
const CURVE_SHAPES = [
  CurveShape.Standard,
  CurveShape.MarketCap,
  CurveShape.TwoSegments,
  CurveShape.LiquidityWeights,
]

const at = <T>(
  fields: Record<string, unknown>,
  key: string,
  read: Reader<T>,
  path: string,
): T => read(fields[key], `${path}.${key}`)

const readBaseFee: Reader<BaseFeeParams> = (value, path) => {
  const f = record(value, path)
  if (f['baseFeeMode'] === BaseFeeMode.RateLimiter) {
    const p = record(f['rateLimiterParam'], `${path}.rateLimiterParam`)
    const rp = `${path}.rateLimiterParam`
    return {
      baseFeeMode: BaseFeeMode.RateLimiter,
      rateLimiterParam: {
        baseFeeBps: at(p, 'baseFeeBps', finiteNumber, rp),
        feeIncrementBps: at(p, 'feeIncrementBps', finiteNumber, rp),
        referenceAmount: at(p, 'referenceAmount', finiteNumber, rp),
        maxLimiterDuration: at(p, 'maxLimiterDuration', finiteNumber, rp),
      },
    }
  }
  const p = record(f['feeSchedulerParam'], `${path}.feeSchedulerParam`)
  const sp = `${path}.feeSchedulerParam`
  return {
    baseFeeMode: at(f, 'baseFeeMode', oneOf(SCHEDULER_MODES), path),
    feeSchedulerParam: {
      startingFeeBps: at(p, 'startingFeeBps', finiteNumber, sp),
      endingFeeBps: at(p, 'endingFeeBps', finiteNumber, sp),
      numberOfPeriod: at(p, 'numberOfPeriod', finiteNumber, sp),
      totalDuration: at(p, 'totalDuration', finiteNumber, sp),
    },
  }
}

const readVesting: Reader<LiquidityVestingInfoParams> = (value, path) => {
  const f = record(value, path)
  return {
    vestingPercentage: at(f, 'vestingPercentage', finiteNumber, path),
    bpsPerPeriod: at(f, 'bpsPerPeriod', finiteNumber, path),
    numberOfPeriods: at(f, 'numberOfPeriods', finiteNumber, path),
    cliffDurationFromMigrationTime: at(
      f,
      'cliffDurationFromMigrationTime',
      finiteNumber,
      path,
    ),
    totalDuration: at(f, 'totalDuration', finiteNumber, path),
  }
}

const readMigratedPoolFee: Reader<
  NonNullable<BuildCurveBaseParams['migration']['migratedPoolFee']>
> = (value, path) => {
  const f = record(value, path)
  const marketCap = optional((v, p) => {
    const m = record(v, p)
    return {
      endingBaseFeeBps: at(m, 'endingBaseFeeBps', finiteNumber, p),
      numberOfPeriod: at(m, 'numberOfPeriod', finiteNumber, p),
      priceMultiple: at(m, 'priceMultiple', finiteNumber, p),
      schedulerExpirationDuration: at(
        m,
        'schedulerExpirationDuration',
        finiteNumber,
        p,
      ),
    }
  })(f['marketCapFeeSchedulerParams'], `${path}.marketCapFeeSchedulerParams`)
  const compoundingFeeBps = at(
    f,
    'compoundingFeeBps',
    optional(finiteNumber),
    path,
  )
  const baseFeeMode = at(
    f,
    'baseFeeMode',
    optional(oneOf(DAMM_BASE_FEE_MODES)),
    path,
  )
  return {
    collectFeeMode: at(
      f,
      'collectFeeMode',
      oneOf(MIGRATED_COLLECT_FEE_MODES),
      path,
    ),
    dynamicFee: at(f, 'dynamicFee', oneOf(DAMM_DYNAMIC_FEE_MODES), path),
    poolFeeBps: at(f, 'poolFeeBps', finiteNumber, path),
    ...(compoundingFeeBps === undefined ? {} : { compoundingFeeBps }),
    ...(baseFeeMode === undefined ? {} : { baseFeeMode }),
    ...(marketCap === undefined
      ? {}
      : { marketCapFeeSchedulerParams: marketCap }),
  }
}

const readBase = (
  f: Record<string, unknown>,
  path: string,
): BuildCurveBaseParams => {
  const token = record(f['token'], `${path}.token`)
  const fee = record(f['fee'], `${path}.fee`)
  const migration = record(f['migration'], `${path}.migration`)
  const migrationFee = record(
    migration['migrationFee'],
    `${path}.migration.migrationFee`,
  )
  const liquidity = record(
    f['liquidityDistribution'],
    `${path}.liquidityDistribution`,
  )
  const vesting = record(f['lockedVesting'], `${path}.lockedVesting`)
  const tp = `${path}.token`
  const fp = `${path}.fee`
  const mp = `${path}.migration`
  const lp = `${path}.liquidityDistribution`
  const vp = `${path}.lockedVesting`
  const migratedPoolFee = at(
    migration,
    'migratedPoolFee',
    optional(readMigratedPoolFee),
    mp,
  )
  const partnerVesting = at(
    liquidity,
    'partnerLiquidityVestingInfoParams',
    optional(readVesting),
    lp,
  )
  const creatorVesting = at(
    liquidity,
    'creatorLiquidityVestingInfoParams',
    optional(readVesting),
    lp,
  )
  return {
    token: {
      tokenType: at(token, 'tokenType', oneOf(TOKEN_TYPES), tp),
      tokenBaseDecimal: at(
        token,
        'tokenBaseDecimal',
        oneOf(TOKEN_DECIMALS),
        tp,
      ),
      tokenQuoteDecimal: at(token, 'tokenQuoteDecimal', finiteNumber, tp),
      tokenAuthorityOption: at(
        token,
        'tokenAuthorityOption',
        oneOf(TOKEN_AUTHORITIES),
        tp,
      ),
      totalTokenSupply: at(token, 'totalTokenSupply', finiteNumber, tp),
      leftover: at(token, 'leftover', finiteNumber, tp),
    },
    fee: {
      baseFeeParams: at(fee, 'baseFeeParams', readBaseFee, fp),
      dynamicFeeEnabled: at(fee, 'dynamicFeeEnabled', boolean, fp),
      collectFeeMode: at(fee, 'collectFeeMode', oneOf(COLLECT_FEE_MODES), fp),
      creatorTradingFeePercentage: at(
        fee,
        'creatorTradingFeePercentage',
        finiteNumber,
        fp,
      ),
      poolCreationFee: at(fee, 'poolCreationFee', finiteNumber, fp),
      enableFirstSwapWithMinFee: at(
        fee,
        'enableFirstSwapWithMinFee',
        boolean,
        fp,
      ),
    },
    migration: {
      migrationOption: at(
        migration,
        'migrationOption',
        oneOf(MIGRATION_OPTIONS),
        mp,
      ),
      migrationFeeOption: at(
        migration,
        'migrationFeeOption',
        oneOf(MIGRATION_FEE_OPTIONS),
        mp,
      ),
      migrationFee: {
        feePercentage: at(
          migrationFee,
          'feePercentage',
          finiteNumber,
          `${mp}.migrationFee`,
        ),
        creatorFeePercentage: at(
          migrationFee,
          'creatorFeePercentage',
          finiteNumber,
          `${mp}.migrationFee`,
        ),
      },
      ...(migratedPoolFee === undefined ? {} : { migratedPoolFee }),
    },
    liquidityDistribution: {
      partnerLiquidityPercentage: at(
        liquidity,
        'partnerLiquidityPercentage',
        finiteNumber,
        lp,
      ),
      partnerPermanentLockedLiquidityPercentage: at(
        liquidity,
        'partnerPermanentLockedLiquidityPercentage',
        finiteNumber,
        lp,
      ),
      creatorLiquidityPercentage: at(
        liquidity,
        'creatorLiquidityPercentage',
        finiteNumber,
        lp,
      ),
      creatorPermanentLockedLiquidityPercentage: at(
        liquidity,
        'creatorPermanentLockedLiquidityPercentage',
        finiteNumber,
        lp,
      ),
      ...(partnerVesting === undefined
        ? {}
        : { partnerLiquidityVestingInfoParams: partnerVesting }),
      ...(creatorVesting === undefined
        ? {}
        : { creatorLiquidityVestingInfoParams: creatorVesting }),
    },
    lockedVesting: {
      totalLockedVestingAmount: at(
        vesting,
        'totalLockedVestingAmount',
        finiteNumber,
        vp,
      ),
      numberOfVestingPeriod: at(
        vesting,
        'numberOfVestingPeriod',
        finiteNumber,
        vp,
      ),
      cliffUnlockAmount: at(vesting, 'cliffUnlockAmount', finiteNumber, vp),
      totalVestingDuration: at(
        vesting,
        'totalVestingDuration',
        finiteNumber,
        vp,
      ),
      cliffDurationFromMigrationTime: at(
        vesting,
        'cliffDurationFromMigrationTime',
        finiteNumber,
        vp,
      ),
    },
    activationType: at(f, 'activationType', oneOf(ACTIVATION_TYPES), path),
  }
}

const readCurve = (f: Record<string, unknown>, path: string): CurveSpec => {
  const shape = at(f, 'curveShape', oneOf(CURVE_SHAPES), path)
  switch (shape) {
    case CurveShape.Standard:
      return {
        curveShape: shape,
        percentageSupplyOnMigration: at(
          f,
          'percentageSupplyOnMigration',
          finiteNumber,
          path,
        ),
        migrationQuoteThreshold: at(
          f,
          'migrationQuoteThreshold',
          finiteNumber,
          path,
        ),
      }
    case CurveShape.MarketCap:
      return {
        curveShape: shape,
        initialMarketCap: at(f, 'initialMarketCap', finiteNumber, path),
        migrationMarketCap: at(f, 'migrationMarketCap', finiteNumber, path),
      }
    case CurveShape.TwoSegments:
      return {
        curveShape: shape,
        initialMarketCap: at(f, 'initialMarketCap', finiteNumber, path),
        migrationMarketCap: at(f, 'migrationMarketCap', finiteNumber, path),
        percentageSupplyOnMigration: at(
          f,
          'percentageSupplyOnMigration',
          finiteNumber,
          path,
        ),
      }
    case CurveShape.LiquidityWeights:
      return {
        curveShape: shape,
        initialMarketCap: at(f, 'initialMarketCap', finiteNumber, path),
        migrationMarketCap: at(f, 'migrationMarketCap', finiteNumber, path),
        liquidityWeights: at(
          f,
          'liquidityWeights',
          arrayOf(finiteNumber, LIQUIDITY_WEIGHT_SEGMENTS),
          path,
        ),
      }
  }
}

/** A complete, well-typed launch config rebuilt from untrusted JSON, or a `ReadError`. */
export const readLaunchConfig: Reader<LaunchConfig> = (value, path) => {
  const fields = record(value, path)
  return {
    ...readBase(fields, path),
    // Links made before other quote tokens existed carry none: they were SOL.
    quoteToken:
      at(fields, 'quoteToken', optional(oneOf(QUOTE_TOKEN_ORDER)), path) ??
      QuoteToken.Sol,
    ...readCurve(fields, path),
  }
}

export { ReadError }
