import { afterEach, describe, expect, it } from 'vitest'
import {
  CollectFeeMode,
  TokenAuthorityOption,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { configTerms } from '../core/config-deploy'
import {
  compileLaunchConfig,
  DEFAULT_LAUNCH_CONFIG,
  LAUNCH_PRESETS,
  LaunchPresetId,
} from '../core/launch-config'
import { QuoteToken } from '../core/quote-token'
import { DEFAULT_SCENARIO } from '../core/sniper-scenario'
import { compareRow, presetEntry } from '../features/comparison'
import { encodeSharedConfig, shareLink } from '../features/config-sharing'
import {
  ConfigSource,
  DEFAULT_LAB_URL,
  LAB_URL_ENV,
  MCP_TEXT,
} from './constants'
import {
  labUrl,
  readableTerms,
  resolveDesign,
  resolveEntry,
  rowSummary,
  toolRefusal,
  toolResult,
} from './utils'

afterEach(() => {
  delete process.env[LAB_URL_ENV]
})

describe('labUrl', () => {
  it('is the live site unless the environment names another', () => {
    expect(labUrl()).toBe(DEFAULT_LAB_URL)
    process.env[LAB_URL_ENV] = 'http://localhost:5180/'
    expect(labUrl()).toBe('http://localhost:5180/')
  })
})

describe('tool answers', () => {
  it('cut fractions to the precision the simulation supports, leaving whole numbers alone', () => {
    const [content] = toolResult({
      sol: 1.234567,
      count: 12,
      nested: [0.00004],
    }).content
    expect(content?.type === 'text' && JSON.parse(content.text)).toEqual({
      sol: 1.2346,
      count: 12,
      nested: [0],
    })
  })

  it('mark a refusal as an error, in its own words', () => {
    expect(toolRefusal('No.')).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'No.' }],
    })
  })
})

describe('readableTerms', () => {
  it('names each SDK option the way the SDK names it', () => {
    const compiled = compileLaunchConfig(DEFAULT_LAUNCH_CONFIG)
    if (!compiled.ok) throw new Error(compiled.reason)
    const terms = readableTerms(
      configTerms(compiled.parameters, QuoteToken.Sol),
    )
    expect(terms.tokenAuthority).toBe(
      TokenAuthorityOption[TokenAuthorityOption.Immutable],
    )
    expect(terms.feesCollectedIn).toBe(
      CollectFeeMode[CollectFeeMode.QuoteToken],
    )
    expect(terms.migrationThreshold).toBe(85)
  })
})

describe('resolveDesign', () => {
  it('resolves a built-in preset by id', () => {
    const design = resolveDesign({
      source: ConfigSource.Preset,
      id: LaunchPresetId.SniperShield,
    })
    const preset = LAUNCH_PRESETS.find(
      (candidate) => candidate.id === LaunchPresetId.SniperShield,
    )
    expect(design).toMatchObject({
      ok: true,
      label: { id: LaunchPresetId.SniperShield, name: preset?.name },
      shared: { config: preset?.config },
    })
  })

  it('reads a share link or its bare encoded config alike', () => {
    const shared = { config: DEFAULT_LAUNCH_CONFIG, name: 'Mine' }
    const fromLink = resolveDesign({
      source: ConfigSource.Shared,
      link: shareLink(shared, DEFAULT_LAB_URL),
    })
    const fromValue = resolveDesign({
      source: ConfigSource.Shared,
      link: encodeSharedConfig(shared),
    })
    expect(fromLink).toMatchObject({ ok: true, label: { name: 'Mine' } })
    expect(fromValue).toEqual(fromLink)
  })

  it('names an unnamed config and refuses one the program would not accept', () => {
    expect(
      resolveDesign({
        source: ConfigSource.Config,
        config: DEFAULT_LAUNCH_CONFIG,
      }),
    ).toMatchObject({ ok: true, label: { name: MCP_TEXT.unnamedConfig } })
    expect(
      resolveDesign({
        source: ConfigSource.Config,
        config: { ...DEFAULT_LAUNCH_CONFIG, curveShape: 'spiral' },
      }),
    ).toMatchObject({ ok: false })
  })
})

describe('resolveEntry', () => {
  it('compiles a design without touching the network', async () => {
    const entry = await resolveEntry({
      source: ConfigSource.Preset,
      id: LaunchPresetId.Flat,
    })
    expect(entry).toMatchObject({
      ok: true,
      entry: { id: LaunchPresetId.Flat, compiled: { ok: true } },
    })
  })
})

describe('rowSummary', () => {
  it('reduces a row to its metrics, price summary and pullable liquidity', () => {
    const [preset] = LAUNCH_PRESETS
    if (!preset) throw new Error('no presets')
    const summary = rowSummary(
      compareRow(presetEntry(preset), DEFAULT_SCENARIO),
    )
    expect(summary).toMatchObject({
      id: preset.id,
      ok: true,
      pullableLiquidityPercent: 0,
    })
    expect(summary.price?.peakMultiple ?? 0).toBeGreaterThanOrEqual(1)
  })

  it('passes on why a config could not run', () => {
    expect(
      rowSummary({
        entry: {
          id: 'x',
          name: 'X',
          intent: '',
          compiled: { ok: false, reason: 'refused' },
        },
        ok: false,
        reason: 'refused',
      }),
    ).toEqual({ id: 'x', name: 'X', intent: '', ok: false, reason: 'refused' })
  })
})
