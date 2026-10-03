import { describe, expect, it } from 'vitest'
import {
  CollectFeeMode,
  MigrationFeeOption,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import {
  CurveShape,
  DEFAULT_LAUNCH_CONFIG,
  defaultCurve,
  LAUNCH_PRESETS,
  parseLaunchConfig,
  serializeLaunchConfig,
  withCurve,
  withQuoteToken,
} from '../../core/launch-config'
import type { LaunchConfig } from '../../core/launch-config'
import { QuoteToken } from '../../core/quote-token'
import {
  applyEdit,
  DynamicFeeChoice,
  EDITOR_FIELDS,
  EditorFieldId,
  editorStatus,
  EditRejection,
  FeeCurve,
  FieldKind,
} from '.'
import type { EditorField } from '.'

const field = (id: EditorFieldId): EditorField => {
  const found = EDITOR_FIELDS.find((f) => f.id === id)
  if (!found) throw new Error(`no field ${id}`)
  return found
}

const edit = (
  config: LaunchConfig,
  id: EditorFieldId,
  value: number,
): LaunchConfig => {
  const result = applyEdit(config, field(id), value)
  if (!result.ok) throw new Error(result.reason)
  return result.config
}

const shield =
  LAUNCH_PRESETS.find((p) => p.id === 'sniper-shield')?.config ??
  DEFAULT_LAUNCH_CONFIG
const customMigration = edit(
  DEFAULT_LAUNCH_CONFIG,
  EditorFieldId.MigratedPoolFeeOption,
  MigrationFeeOption.Customizable,
)

/** A config on which the field is visible. */
const weighted = withCurve(
  DEFAULT_LAUNCH_CONFIG,
  defaultCurve(CurveShape.LiquidityWeights),
)

const configFor = (f: EditorField): LaunchConfig =>
  [DEFAULT_LAUNCH_CONFIG, shield, customMigration, weighted].find((c) =>
    f.visible(c),
  ) ?? DEFAULT_LAUNCH_CONFIG

describe('EDITOR_FIELDS', () => {
  it.each(
    EDITOR_FIELDS.filter((f) => f.kind === FieldKind.Number).map((f) => [
      f.id,
      f,
    ]),
  )('%s reads back what was written', (_, f) => {
    if (f.kind !== FieldKind.Number) return
    const value = f.min + f.step * 3 <= f.max ? f.min + f.step * 3 : f.min
    const config = edit(configFor(f), f.id, value)
    expect(f.read(config)).toBeCloseTo(value)
  })

  it.each(EDITOR_FIELDS.map((f) => [f.id, f]))(
    '%s never mutates the config it edits',
    (_, f) => {
      const original = configFor(f)
      const before = serializeLaunchConfig(original)
      const value =
        f.kind === FieldKind.Select
          ? (f.options[1]?.value ?? f.options[0].value)
          : f.min
      applyEdit(original, f, value)
      expect(serializeLaunchConfig(original)).toBe(before)
    },
  )

  it('has unique ids', () => {
    expect(new Set(EDITOR_FIELDS.map((f) => f.id)).size).toBe(
      EDITOR_FIELDS.length,
    )
  })
})

describe('applyEdit', () => {
  it('rejects a non-number', () => {
    expect(
      applyEdit(
        DEFAULT_LAUNCH_CONFIG,
        field(EditorFieldId.MigrationThreshold),
        Number.NaN,
      ),
    ).toEqual({
      ok: false,
      reason: EditRejection.NotANumber,
    })
  })

  it('rejects a value that is not one of a select field’s options', () => {
    expect(
      applyEdit(DEFAULT_LAUNCH_CONFIG, field(EditorFieldId.BaseDecimals), 5),
    ).toMatchObject({
      ok: false,
      reason: EditRejection.NotAnOption,
    })
  })

  it('rejects edits to a field that does not apply', () => {
    expect(
      applyEdit(DEFAULT_LAUNCH_CONFIG, field(EditorFieldId.FeeWindow), 30),
    ).toMatchObject({
      ok: false,
      reason: EditRejection.Hidden,
    })
  })

  it('turning a flat fee into a falling one gives it a sensible opening fee and window', () => {
    const config = edit(
      DEFAULT_LAUNCH_CONFIG,
      EditorFieldId.FeeCurve,
      FeeCurve.Linear,
    )
    expect(field(EditorFieldId.StartingFee).read(config)).toBe(50)
    expect(field(EditorFieldId.FeeWindow).read(config)).toBe(10)
    expect(editorStatus(config)).toMatchObject({ valid: true })
  })

  it('a flat fee keeps start and end together', () => {
    const config = edit(DEFAULT_LAUNCH_CONFIG, EditorFieldId.EndingFee, 2)
    expect(field(EditorFieldId.StartingFee).read(config)).toBe(2)
    expect(field(EditorFieldId.FeeCurve).read(config)).toBe(FeeCurve.Flat)
  })

  it('shows the migrated pool fee only for a customizable migration', () => {
    expect(
      field(EditorFieldId.MigratedPoolFee).visible(DEFAULT_LAUNCH_CONFIG),
    ).toBe(false)
    expect(field(EditorFieldId.MigratedPoolFee).visible(customMigration)).toBe(
      true,
    )
  })
})

describe('editorStatus', () => {
  it('turns on the volatility fee as a config Meteora accepts and the tool simulates', () => {
    const config = edit(
      DEFAULT_LAUNCH_CONFIG,
      EditorFieldId.DynamicFee,
      DynamicFeeChoice.On,
    )
    expect(config.fee.dynamicFeeEnabled).toBe(true)
    expect(editorStatus(config)).toMatchObject({
      valid: true,
      simulatable: true,
    })
  })

  it('takes fees in the bought token when asked', () => {
    const config = edit(
      DEFAULT_LAUNCH_CONFIG,
      EditorFieldId.FeeCollection,
      CollectFeeMode.OutputToken,
    )
    expect(config.fee.collectFeeMode).toBe(CollectFeeMode.OutputToken)
    expect(editorStatus(config)).toMatchObject({
      valid: true,
      simulatable: true,
    })
  })

  it('accepts every built-in preset, each one graduating automatically', () => {
    LAUNCH_PRESETS.forEach((p) =>
      expect(editorStatus(p.config)).toEqual({
        valid: true,
        simulatable: true,
        keepersMigrate: true,
      }),
    )
  })

  it('says when a threshold is below what the migration keepers act on', () => {
    const below = { ...DEFAULT_LAUNCH_CONFIG, migrationQuoteThreshold: 9 }
    expect(editorStatus(below)).toMatchObject({
      valid: true,
      keepersMigrate: false,
    })
    const usdc = withQuoteToken(DEFAULT_LAUNCH_CONFIG, QuoteToken.Usdc)
    expect(editorStatus(usdc)).toMatchObject({
      valid: true,
      keepersMigrate: true,
    })
    expect(
      editorStatus(
        withCurve(usdc, {
          curveShape: CurveShape.Standard,
          percentageSupplyOnMigration: 20,
          migrationQuoteThreshold: 749,
        }),
      ),
    ).toMatchObject({ valid: true, keepersMigrate: false })
  })

  it('reports the program’s reason when the LP split does not add up to 100%', () => {
    const config = edit(
      DEFAULT_LAUNCH_CONFIG,
      EditorFieldId.PartnerLiquidity,
      10,
    )
    const status = editorStatus(config)
    expect(status.valid).toBe(false)
    expect(status.valid ? '' : status.reason).not.toBe('')
  })

  it('round-trips an edited config through a plain document', () => {
    const config = edit(shield, EditorFieldId.FeeWindow, 25)
    expect(parseLaunchConfig(serializeLaunchConfig(config))).toEqual(config)
  })
})

describe('curve shapes', () => {
  it.each(Object.values(CurveShape))(
    'a %s curve compiles from its defaults',
    (shape) => {
      const config = withCurve(DEFAULT_LAUNCH_CONFIG, defaultCurve(shape))
      expect(editorStatus(config)).toMatchObject({
        valid: true,
        simulatable: true,
      })
    },
  )

  it('switching shape shows only that shape’s fields', () => {
    const config = edit(DEFAULT_LAUNCH_CONFIG, EditorFieldId.CurveShape, 1) // market cap
    expect(field(EditorFieldId.MigrationThreshold).visible(config)).toBe(false)
    expect(field(EditorFieldId.InitialMarketCap).visible(config)).toBe(true)
    expect(field(EditorFieldId.WeightGrowth).visible(config)).toBe(false)
  })

  it('a two-segment or weighted curve gets the leftover buffer its builder needs', () => {
    const config = edit(DEFAULT_LAUNCH_CONFIG, EditorFieldId.CurveShape, 2) // two segments
    expect(field(EditorFieldId.Leftover).read(config)).toBeGreaterThan(0)
    expect(editorStatus(config)).toMatchObject({ valid: true })
  })
})
