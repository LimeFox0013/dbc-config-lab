import type { LaunchPreset } from '../../core/launch-config'

export interface ConfigEditorProps {
  /** Configs the editor can start from; each is copied, never changed. */
  presets: LaunchPreset[]
}
