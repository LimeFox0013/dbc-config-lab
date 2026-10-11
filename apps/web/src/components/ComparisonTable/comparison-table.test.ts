import { describe, expect, it } from 'vitest'
import en from '@dbc-config-lab/core/locales/en.json'
import { LAUNCH_PRESETS } from '@dbc-config-lab/core/core/launch-config'
import { DEFAULT_SCENARIO } from '@dbc-config-lab/core/core/sniper-scenario'
import {
  compareConfigs,
  presetEntry,
} from '@dbc-config-lab/core/features/comparison'
import type { ComparisonRow } from '@dbc-config-lab/core/features/comparison'
import { renderComponent } from '../../testing'
import ComparisonTable from './ComparisonTable.vue'

/** Cells a refused config spans: every outcome column. */
const OUTCOME_COLUMNS = 6

const render = (rows: ComparisonRow[]): Promise<string> =>
  renderComponent(ComparisonTable, { rows })

const firstPreset = (): ComparisonRow['entry'] => {
  const [preset] = LAUNCH_PRESETS
  if (!preset) throw new Error('No built-in preset')
  return presetEntry(preset)
}

describe('ComparisonTable', () => {
  it('shows each simulated config by name and intent, with its outcome', async () => {
    const entry = firstPreset()
    const html = await render(compareConfigs([entry], DEFAULT_SCENARIO))
    expect(html).toContain(en.components.comparisonTable.caption)
    expect(html).toContain(entry.name)
    expect(html).toContain(entry.intent)
    expect(html).not.toContain(`colspan="${OUTCOME_COLUMNS}"`)
  })

  it('states why a config could not be simulated, across the outcome columns', async () => {
    const html = await render([
      {
        entry: firstPreset(),
        ok: false,
        reason: 'migration threshold too low',
      },
    ])
    expect(html).toContain(`colspan="${OUTCOME_COLUMNS}"`)
    expect(html).toContain('Not simulated: migration threshold too low')
  })
})
