import {
  BaseFeeMode,
  CollectFeeMode,
  DammV2DynamicFeeMode,
  MigratedCollectFeeMode,
  MigrationFeeOption,
  TokenDecimal,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import {
  curveOf,
  CurveShape,
  defaultCurve,
  geometricWeights,
  scheduleOf,
  weightGrowthOf,
  withCurve,
  withSchedule,
} from '../../core/launch-config'
import type {
  CurveSpec,
  FeeSchedule,
  LaunchConfig,
} from '../../core/launch-config'
import { isEnumValue } from '../../core/shared'
import {
  BPS_PER_PERCENT,
  CURVE_SHAPE_ORDER,
  DEFAULT_CUSTOM_MIGRATED_POOL_FEE_BPS,
  DynamicFeeChoice,
  EditorFieldId,
  FeeCurve,
  FieldGroup,
  FieldKind,
  FieldUnit,
  LIMITS,
  WEIGHT_GROWTH_LIMITS,
} from './constants'
import type { EditorField } from './types'

/** Opening fee and window given to a flat fee when the user switches it to a falling one. */
const FALLING_FEE_DEFAULTS = { startingFeeBps: 5000, windowSeconds: 10 }

const isTokenDecimal = isEnumValue<TokenDecimal>(Object.values(TokenDecimal))
const isMigrationFeeOption = isEnumValue<MigrationFeeOption>(
  Object.values(MigrationFeeOption),
)
const isFeeCurve = isEnumValue<FeeCurve>(Object.values(FeeCurve))
const isDynamicFeeChoice = isEnumValue<DynamicFeeChoice>(
  Object.values(DynamicFeeChoice),
)
const isCollectFeeMode = isEnumValue<CollectFeeMode>(
  Object.values(CollectFeeMode),
)

const always = (): boolean => true

const feeCurveOf = (schedule: FeeSchedule): FeeCurve =>
  schedule.windowSeconds === 0 ||
  schedule.startingFeeBps === schedule.endingFeeBps
    ? FeeCurve.Flat
    : schedule.mode === BaseFeeMode.FeeSchedulerExponential
      ? FeeCurve.Exponential
      : FeeCurve.Linear

/** Applies a change to the fee schedule; a config without an editable schedule is left as is. */
const patchSchedule = (
  config: LaunchConfig,
  patch: (schedule: FeeSchedule) => FeeSchedule,
): LaunchConfig => {
  const schedule = scheduleOf(config)
  return schedule ? withSchedule(config, patch(schedule)) : config
}

const toCurve = (schedule: FeeSchedule, curve: FeeCurve): FeeSchedule => {
  if (curve === FeeCurve.Flat) {
    return {
      mode: BaseFeeMode.FeeSchedulerLinear,
      startingFeeBps: schedule.endingFeeBps,
      endingFeeBps: schedule.endingFeeBps,
      windowSeconds: 0,
    }
  }
  const wasFlat = feeCurveOf(schedule) === FeeCurve.Flat
  return {
    mode:
      curve === FeeCurve.Exponential
        ? BaseFeeMode.FeeSchedulerExponential
        : BaseFeeMode.FeeSchedulerLinear,
    startingFeeBps: wasFlat
      ? FALLING_FEE_DEFAULTS.startingFeeBps
      : schedule.startingFeeBps,
    endingFeeBps: schedule.endingFeeBps,
    windowSeconds: wasFlat
      ? FALLING_FEE_DEFAULTS.windowSeconds
      : schedule.windowSeconds,
  }
}

const hasSchedule = (config: LaunchConfig): boolean =>
  scheduleOf(config) !== null
const isFalling = (config: LaunchConfig): boolean => {
  const schedule = scheduleOf(config)
  return schedule !== null && feeCurveOf(schedule) !== FeeCurve.Flat
}

const percentField = (
  id: EditorFieldId,
  group: FieldGroup,
  read: EditorField['read'],
  write: EditorField['write'],
  max = 100,
  visible: EditorField['visible'] = always,
): EditorField => ({
  id,
  group,
  kind: FieldKind.Number,
  unit: FieldUnit.Percent,
  min: 0,
  max,
  step: 1,
  read,
  write,
  visible,
})

const liquidity = (config: LaunchConfig) => config.liquidityDistribution

/** Applies a change to the curve part of a config. */
const patchCurve = (
  config: LaunchConfig,
  patch: (curve: CurveSpec) => CurveSpec,
): LaunchConfig => withCurve(config, patch(curveOf(config)))

const shapeIs =
  (...shapes: CurveShape[]) =>
  (config: LaunchConfig): boolean =>
    shapes.includes(config.curveShape)

const hasMarketCaps = shapeIs(
  CurveShape.MarketCap,
  CurveShape.TwoSegments,
  CurveShape.LiquidityWeights,
)

const marketCapField = (
  id: EditorFieldId,
  key: 'initialMarketCap' | 'migrationMarketCap',
): EditorField => ({
  id,
  group: FieldGroup.Curve,
  kind: FieldKind.Number,
  unit: FieldUnit.Sol,
  min: 1,
  max: 1_000_000_000,
  step: 1,
  read: (c) => (c.curveShape === CurveShape.Standard ? 0 : c[key]),
  write: (c, v) =>
    patchCurve(c, (curve) =>
      curve.curveShape === CurveShape.Standard ? curve : { ...curve, [key]: v },
    ),
  visible: hasMarketCaps,
})

/** Every editable field, in display order. */
export const EDITOR_FIELDS: EditorField[] = [
  {
    id: EditorFieldId.TotalSupply,
    group: FieldGroup.Token,
    kind: FieldKind.Number,
    unit: FieldUnit.Tokens,
    min: 1,
    max: 1_000_000_000_000,
    step: 1,
    read: (c) => c.token.totalTokenSupply,
    write: (c, v) => ({
      ...c,
      token: { ...c.token, totalTokenSupply: Math.trunc(v) },
    }),
    visible: always,
  },
  {
    id: EditorFieldId.BaseDecimals,
    group: FieldGroup.Token,
    kind: FieldKind.Select,
    unit: FieldUnit.None,
    options: [
      TokenDecimal.SIX,
      TokenDecimal.SEVEN,
      TokenDecimal.EIGHT,
      TokenDecimal.NINE,
    ].map((value) => ({
      value,
      labelKey: `decimals.${value}`,
    })),
    read: (c) => c.token.tokenBaseDecimal,
    write: (c, v) =>
      isTokenDecimal(v)
        ? { ...c, token: { ...c.token, tokenBaseDecimal: v } }
        : c,
    visible: always,
  },
  {
    id: EditorFieldId.Leftover,
    group: FieldGroup.Token,
    kind: FieldKind.Number,
    unit: FieldUnit.Tokens,
    min: 0,
    max: 1_000_000_000_000,
    step: 1,
    read: (c) => c.token.leftover,
    write: (c, v) => ({ ...c, token: { ...c.token, leftover: Math.trunc(v) } }),
    visible: always,
  },
  {
    id: EditorFieldId.CurveShape,
    group: FieldGroup.Curve,
    kind: FieldKind.Select,
    unit: FieldUnit.None,
    options: CURVE_SHAPE_ORDER.map((shape, index) => ({
      value: index,
      labelKey: `curveShape.${shape}`,
    })),
    read: (c) => CURVE_SHAPE_ORDER.indexOf(c.curveShape),
    write: (c, v) => {
      const shape = CURVE_SHAPE_ORDER[v]
      return shape === undefined || shape === c.curveShape
        ? c
        : withCurve(c, defaultCurve(shape))
    },
    visible: always,
  },
  percentField(
    EditorFieldId.SupplyOnMigration,
    FieldGroup.Curve,
    (c) =>
      c.curveShape === CurveShape.Standard ||
      c.curveShape === CurveShape.TwoSegments
        ? c.percentageSupplyOnMigration
        : 0,
    (c, v) =>
      patchCurve(c, (curve) =>
        curve.curveShape === CurveShape.Standard ||
        curve.curveShape === CurveShape.TwoSegments
          ? { ...curve, percentageSupplyOnMigration: v }
          : curve,
      ),
    100,
    shapeIs(CurveShape.Standard, CurveShape.TwoSegments),
  ),
  {
    id: EditorFieldId.MigrationThreshold,
    group: FieldGroup.Curve,
    kind: FieldKind.Number,
    unit: FieldUnit.Sol,
    min: 1,
    max: 100_000,
    step: 1,
    read: (c) =>
      c.curveShape === CurveShape.Standard ? c.migrationQuoteThreshold : 0,
    write: (c, v) =>
      patchCurve(c, (curve) =>
        curve.curveShape === CurveShape.Standard
          ? { ...curve, migrationQuoteThreshold: v }
          : curve,
      ),
    visible: shapeIs(CurveShape.Standard),
  },
  marketCapField(EditorFieldId.InitialMarketCap, 'initialMarketCap'),
  marketCapField(EditorFieldId.MigrationMarketCap, 'migrationMarketCap'),
  {
    id: EditorFieldId.WeightGrowth,
    group: FieldGroup.Curve,
    kind: FieldKind.Number,
    unit: FieldUnit.None,
    ...WEIGHT_GROWTH_LIMITS,
    read: (c) =>
      c.curveShape === CurveShape.LiquidityWeights
        ? weightGrowthOf(c.liquidityWeights)
        : 1,
    write: (c, v) =>
      patchCurve(c, (curve) =>
        curve.curveShape === CurveShape.LiquidityWeights
          ? { ...curve, liquidityWeights: geometricWeights(v) }
          : curve,
      ),
    visible: shapeIs(CurveShape.LiquidityWeights),
  },
  {
    id: EditorFieldId.FeeCurve,
    group: FieldGroup.Fees,
    kind: FieldKind.Select,
    unit: FieldUnit.None,
    options: [FeeCurve.Flat, FeeCurve.Linear, FeeCurve.Exponential].map(
      (value) => ({ value, labelKey: `feeCurve.${value}` }),
    ),
    read: (c) => {
      const schedule = scheduleOf(c)
      return schedule ? feeCurveOf(schedule) : FeeCurve.Flat
    },
    write: (c, v) =>
      isFeeCurve(v) ? patchSchedule(c, (s) => toCurve(s, v)) : c,
    visible: hasSchedule,
  },
  {
    id: EditorFieldId.StartingFee,
    group: FieldGroup.Fees,
    kind: FieldKind.Number,
    unit: FieldUnit.Percent,
    min: LIMITS.minFeePercent,
    max: LIMITS.maxFeePercent,
    step: 0.25,
    read: (c) => (scheduleOf(c)?.startingFeeBps ?? 0) / BPS_PER_PERCENT,
    write: (c, v) =>
      patchSchedule(c, (s) => ({
        ...s,
        startingFeeBps: Math.round(v * BPS_PER_PERCENT),
      })),
    visible: isFalling,
  },
  {
    id: EditorFieldId.EndingFee,
    group: FieldGroup.Fees,
    kind: FieldKind.Number,
    unit: FieldUnit.Percent,
    min: LIMITS.minFeePercent,
    max: LIMITS.maxFeePercent,
    step: 0.25,
    read: (c) => (scheduleOf(c)?.endingFeeBps ?? 0) / BPS_PER_PERCENT,
    write: (c, v) =>
      patchSchedule(c, (s) => {
        const endingFeeBps = Math.round(v * BPS_PER_PERCENT)
        return feeCurveOf(s) === FeeCurve.Flat
          ? { ...s, startingFeeBps: endingFeeBps, endingFeeBps }
          : { ...s, endingFeeBps }
      }),
    visible: hasSchedule,
  },
  {
    id: EditorFieldId.FeeWindow,
    group: FieldGroup.Fees,
    kind: FieldKind.Number,
    unit: FieldUnit.Seconds,
    min: 1,
    max: 3600,
    step: 1,
    read: (c) => scheduleOf(c)?.windowSeconds ?? 0,
    write: (c, v) =>
      patchSchedule(c, (s) => ({ ...s, windowSeconds: Math.trunc(v) })),
    visible: isFalling,
  },
  percentField(
    EditorFieldId.CreatorTradingFeeShare,
    FieldGroup.Fees,
    (c) => c.fee.creatorTradingFeePercentage,
    (c, v) => ({
      ...c,
      fee: { ...c.fee, creatorTradingFeePercentage: Math.trunc(v) },
    }),
  ),
  {
    id: EditorFieldId.DynamicFee,
    group: FieldGroup.Fees,
    kind: FieldKind.Select,
    unit: FieldUnit.None,
    options: [DynamicFeeChoice.Off, DynamicFeeChoice.On].map((value) => ({
      value,
      labelKey: `dynamicFee.${value}`,
    })),
    read: (c) =>
      c.fee.dynamicFeeEnabled ? DynamicFeeChoice.On : DynamicFeeChoice.Off,
    write: (c, v) =>
      isDynamicFeeChoice(v)
        ? {
            ...c,
            fee: { ...c.fee, dynamicFeeEnabled: v === DynamicFeeChoice.On },
          }
        : c,
    visible: always,
  },
  {
    id: EditorFieldId.FeeCollection,
    group: FieldGroup.Fees,
    kind: FieldKind.Select,
    unit: FieldUnit.None,
    options: [CollectFeeMode.QuoteToken, CollectFeeMode.OutputToken].map(
      (value) => ({ value, labelKey: `feeCollection.${value}` }),
    ),
    read: (c) => c.fee.collectFeeMode,
    write: (c, v) =>
      isCollectFeeMode(v) ? { ...c, fee: { ...c.fee, collectFeeMode: v } } : c,
    visible: always,
  },
  {
    id: EditorFieldId.MigratedPoolFeeOption,
    group: FieldGroup.Migration,
    kind: FieldKind.Select,
    unit: FieldUnit.None,
    options: [
      MigrationFeeOption.FixedBps25,
      MigrationFeeOption.FixedBps30,
      MigrationFeeOption.FixedBps100,
      MigrationFeeOption.FixedBps200,
      MigrationFeeOption.FixedBps400,
      MigrationFeeOption.FixedBps600,
      MigrationFeeOption.Customizable,
    ].map((value) => ({ value, labelKey: `migratedPoolFeeOption.${value}` })),
    read: (c) => c.migration.migrationFeeOption,
    write: (c, v) => {
      if (!isMigrationFeeOption(v)) return c
      const migratedPoolFee =
        v === MigrationFeeOption.Customizable
          ? (c.migration.migratedPoolFee ?? {
              collectFeeMode: MigratedCollectFeeMode.QuoteToken,
              dynamicFee: DammV2DynamicFeeMode.Disabled,
              poolFeeBps: DEFAULT_CUSTOM_MIGRATED_POOL_FEE_BPS,
            })
          : undefined
      return {
        ...c,
        migration: { ...c.migration, migrationFeeOption: v, migratedPoolFee },
      }
    },
    visible: always,
  },
  {
    id: EditorFieldId.MigratedPoolFee,
    group: FieldGroup.Migration,
    kind: FieldKind.Number,
    unit: FieldUnit.Percent,
    min: LIMITS.minMigratedPoolFeePercent,
    max: LIMITS.maxMigratedPoolFeePercent,
    step: 0.05,
    read: (c) =>
      (c.migration.migratedPoolFee?.poolFeeBps ?? 0) / BPS_PER_PERCENT,
    write: (c, v) =>
      c.migration.migratedPoolFee
        ? {
            ...c,
            migration: {
              ...c.migration,
              migratedPoolFee: {
                ...c.migration.migratedPoolFee,
                poolFeeBps: Math.round(v * BPS_PER_PERCENT),
              },
            },
          }
        : c,
    visible: (c) =>
      c.migration.migrationFeeOption === MigrationFeeOption.Customizable,
  },
  percentField(
    EditorFieldId.MigrationFee,
    FieldGroup.Migration,
    (c) => c.migration.migrationFee.feePercentage,
    (c, v) => ({
      ...c,
      migration: {
        ...c.migration,
        migrationFee: {
          ...c.migration.migrationFee,
          feePercentage: Math.trunc(v),
        },
      },
    }),
    LIMITS.maxMigrationFeePercent,
  ),
  percentField(
    EditorFieldId.PartnerLiquidity,
    FieldGroup.Liquidity,
    (c) => liquidity(c).partnerLiquidityPercentage,
    (c, v) => ({
      ...c,
      liquidityDistribution: {
        ...liquidity(c),
        partnerLiquidityPercentage: Math.trunc(v),
      },
    }),
  ),
  percentField(
    EditorFieldId.PartnerLockedLiquidity,
    FieldGroup.Liquidity,
    (c) => liquidity(c).partnerPermanentLockedLiquidityPercentage,
    (c, v) => ({
      ...c,
      liquidityDistribution: {
        ...liquidity(c),
        partnerPermanentLockedLiquidityPercentage: Math.trunc(v),
      },
    }),
  ),
  percentField(
    EditorFieldId.CreatorLiquidity,
    FieldGroup.Liquidity,
    (c) => liquidity(c).creatorLiquidityPercentage,
    (c, v) => ({
      ...c,
      liquidityDistribution: {
        ...liquidity(c),
        creatorLiquidityPercentage: Math.trunc(v),
      },
    }),
  ),
  percentField(
    EditorFieldId.CreatorLockedLiquidity,
    FieldGroup.Liquidity,
    (c) => liquidity(c).creatorPermanentLockedLiquidityPercentage,
    (c, v) => ({
      ...c,
      liquidityDistribution: {
        ...liquidity(c),
        creatorPermanentLockedLiquidityPercentage: Math.trunc(v),
      },
    }),
  ),
]
