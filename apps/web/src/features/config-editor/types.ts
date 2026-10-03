import type { LaunchConfig } from '../../core/launch-config'
import type {
  EditorFieldId,
  EditRejection,
  FieldGroup,
  FieldKind,
  FieldUnit,
} from './constants'

export interface SelectOption {
  value: number
  /** Locale key under `components.configEditor.options`. */
  labelKey: string
}

interface FieldBase {
  id: EditorFieldId
  group: FieldGroup
  unit: FieldUnit
  /** The field's current value, in its unit. */
  read: (config: LaunchConfig) => number
  /** The config with this field set to `value` (in its unit); never mutates `config`. */
  write: (config: LaunchConfig, value: number) => LaunchConfig
  /** Whether the field applies to this config (e.g. fee window only for a falling fee). */
  visible: (config: LaunchConfig) => boolean
}

export type EditorField =
  | (FieldBase & {
      kind: FieldKind.Number
      min: number
      max: number
      step: number
    })
  | (FieldBase & { kind: FieldKind.Select; options: SelectOption[] })

export type EditResult =
  { ok: true; config: LaunchConfig } | { ok: false; reason: EditRejection }

/** `keepersMigrate`: Meteora's migration keepers would graduate pools on this config. */
export type EditorStatus =
  | { valid: true; simulatable: true; keepersMigrate: boolean }
  | { valid: true; simulatable: false; reason: string; keepersMigrate: boolean }
  | { valid: false; reason: string }
