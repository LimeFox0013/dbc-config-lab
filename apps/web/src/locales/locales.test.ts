import { describe, expect, it } from 'vitest'
import { Criterion } from '../core/config-search'
import { CurveShape } from '../core/launch-config'
import { ScenarioPresetId } from '../core/sniper-scenario'
import {
  EDITOR_FIELDS,
  FieldKind,
  FieldUnit,
  EditRejection,
} from '../features/config-editor'
import { LoadRejection } from '../features/onchain-config'
import { LaunchGoal } from '../features/recommendation'
import en from './en.json'

/** Looks up a dotted key in the English messages. */
const has = (key: string): boolean =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        typeof node === 'object' && node !== null
          ? Reflect.get(node, part)
          : undefined,
      en,
    ) !== undefined

/** Every key the UI builds from code-side enums and field lists. */
const generatedKeys = (): string[] => [
  ...EDITOR_FIELDS.map((f) => `components.configEditor.fields.${f.id}`),
  ...EDITOR_FIELDS.flatMap((f) =>
    f.kind === FieldKind.Select
      ? f.options.map((o) => `components.configEditor.options.${o.labelKey}`)
      : [],
  ),
  ...EDITOR_FIELDS.filter((f) => f.unit !== FieldUnit.None).map(
    (f) => `components.configEditor.units.${f.unit}`,
  ),
  ...EDITOR_FIELDS.map((f) => `components.configEditor.groups.${f.group}`),
  ...Object.values(EditRejection).map(
    (r) => `components.configEditor.rejections.${r}`,
  ),
  ...Object.values(LaunchGoal).map(
    (g) => `components.recommenderPanel.goals.${g}`,
  ),
  ...Object.values(LoadRejection).map(
    (r) => `components.onChainLoader.rejections.${r}`,
  ),
  ...Object.values(Criterion).map(
    (c) => `components.recommenderPanel.weights.${c}`,
  ),
  ...Object.values(CurveShape).map(
    (s) => `components.recommenderPanel.curves.${s}`,
  ),
  ...Object.values(ScenarioPresetId).flatMap((id) => [
    `components.scenarioControls.presets.${id}.name`,
    `components.scenarioControls.presets.${id}.description`,
  ]),
]

describe('en locale', () => {
  it('has a message for every key the UI generates', () => {
    expect(generatedKeys().filter((key) => !has(key))).toEqual([])
  })
})
