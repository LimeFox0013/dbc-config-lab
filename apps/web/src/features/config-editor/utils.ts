import { compileLaunchConfig } from '../../core/launch-config'
import type { LaunchConfig } from '../../core/launch-config'
import { migratedUnsupportedReason } from '../../core/migrated-pool'
import { EditRejection, FieldKind } from './constants'
import type { EditorField, EditorStatus, EditResult } from './types'

/** Applies a user-entered value to a field, rejecting non-numbers, unknown options and hidden fields. */
export const applyEdit = (
  config: LaunchConfig,
  field: EditorField,
  value: number,
): EditResult => {
  if (!field.visible(config)) return { ok: false, reason: EditRejection.Hidden }
  if (!Number.isFinite(value))
    return { ok: false, reason: EditRejection.NotANumber }
  if (
    field.kind === FieldKind.Select &&
    !field.options.some((option) => option.value === value)
  ) {
    return { ok: false, reason: EditRejection.NotAnOption }
  }
  return { ok: true, config: field.write(config, value) }
}

/**
 * Whether the DBC program would accept the config (with its own reason when not), and
 * whether the simulator can reproduce it across the whole launch.
 */
export const editorStatus = (config: LaunchConfig): EditorStatus => {
  const compiled = compileLaunchConfig(config)
  if (!compiled.ok) return { valid: false, reason: compiled.reason }
  const unsupported = migratedUnsupportedReason(compiled.parameters)
  return unsupported
    ? { valid: true, simulatable: false, reason: unsupported }
    : { valid: true, simulatable: true }
}
