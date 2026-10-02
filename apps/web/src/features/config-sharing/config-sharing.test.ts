import { describe, expect, it } from 'vitest'
import {
  compileLaunchConfig,
  CurveShape,
  DEFAULT_LAUNCH_CONFIG,
  defaultCurve,
  LAUNCH_PRESETS,
  withCurve,
} from '../../core/launch-config'
import type { LaunchConfig } from '../../core/launch-config'
import {
  decodeSharedConfig,
  encodeSharedConfig,
  MAX_SHARE_LENGTH,
  shareLink,
  sharedFromHash,
  ShareRejection,
  toTypeScript,
} from '.'
import { BUILDER_BY_SHAPE } from './constants'
import { readLaunchConfig } from './document'

const encodeRaw = (value: unknown): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const shapes = Object.values(CurveShape).map((shape) =>
  withCurve(DEFAULT_LAUNCH_CONFIG, defaultCurve(shape)),
)

describe('round trip', () => {
  it.each([
    ...LAUNCH_PRESETS.map((p) => [p.id, p.config] as const),
    ...shapes.map((c) => [c.curveShape, c] as const),
  ])('%s reopens exactly', (_, config) => {
    const result = decodeSharedConfig(
      encodeSharedConfig({ config, name: 'Ünïcode — test' }),
    )
    expect(result).toEqual({
      ok: true,
      shared: { config, name: 'Ünïcode — test' },
    })
  })

  it('travels in the URL fragment of a full link', () => {
    const link = shareLink(
      { config: DEFAULT_LAUNCH_CONFIG },
      'https://example.com/lab?x=1',
    )
    const url = new URL(link)
    expect(url.search).toBe('?x=1')
    const encoded = sharedFromHash(url.hash)
    expect(encoded && decodeSharedConfig(encoded)).toMatchObject({ ok: true })
  })
})

describe('untrusted input', () => {
  const reject = (encoded: string) => decodeSharedConfig(encoded)

  it('refuses an oversized link before decoding it', () => {
    expect(reject('A'.repeat(MAX_SHARE_LENGTH + 1))).toEqual({
      ok: false,
      rejection: ShareRejection.TooLong,
    })
  })

  it('refuses text that is not base64url, and bytes that are not UTF-8 JSON', () => {
    expect(reject('***')).toMatchObject({
      rejection: ShareRejection.NotDecodable,
    })
    expect(
      reject(encodeRaw('just a string').slice(0, -2) + '!!'),
    ).toMatchObject({ ok: false })
    expect(reject(btoa('{not json'))).toMatchObject({
      rejection: ShareRejection.NotJson,
    })
  })

  it('refuses an unknown version', () => {
    expect(
      reject(encodeRaw({ v: 99, config: DEFAULT_LAUNCH_CONFIG })),
    ).toMatchObject({ rejection: ShareRejection.WrongVersion })
  })

  it('names the field that is missing or of the wrong type', () => {
    const missing = {
      ...DEFAULT_LAUNCH_CONFIG,
      token: { ...DEFAULT_LAUNCH_CONFIG.token, totalTokenSupply: undefined },
    }
    expect(reject(encodeRaw({ v: 1, config: missing }))).toEqual({
      ok: false,
      rejection: ShareRejection.InvalidField,
      detail: 'config.token.totalTokenSupply',
    })
    const wrongType = {
      ...DEFAULT_LAUNCH_CONFIG,
      migrationQuoteThreshold: '85',
    }
    expect(reject(encodeRaw({ v: 1, config: wrongType }))).toMatchObject({
      detail: 'config.migrationQuoteThreshold',
    })
  })

  it('refuses values outside an enum', () => {
    const badShape = { ...DEFAULT_LAUNCH_CONFIG, curveShape: 'spiral' }
    expect(reject(encodeRaw({ v: 1, config: badShape }))).toMatchObject({
      detail: 'config.curveShape',
    })
  })

  it('refuses a config the DBC program would reject, with its reason', () => {
    const lp = {
      ...DEFAULT_LAUNCH_CONFIG.liquidityDistribution,
      partnerLiquidityPercentage: 10,
    }
    const result = reject(
      encodeRaw({
        v: 1,
        config: { ...DEFAULT_LAUNCH_CONFIG, liquidityDistribution: lp },
      }),
    )
    expect(result).toMatchObject({
      ok: false,
      rejection: ShareRejection.RejectedByProgram,
    })
  })

  it('drops unknown fields, including __proto__, without touching Object.prototype', () => {
    const hostile = JSON.parse(
      `{"v":1,"name":"x","extra":1,"__proto__":{"polluted":true},"config":${JSON.stringify(
        {
          ...DEFAULT_LAUNCH_CONFIG,
          evil: '<script>',
          token: {
            ...DEFAULT_LAUNCH_CONFIG.token,
            constructor: { prototype: { polluted: true } },
          },
        },
      )}}`,
    )
    const result = decodeSharedConfig(encodeRaw(hostile))
    expect(result).toEqual({
      ok: true,
      shared: { config: DEFAULT_LAUNCH_CONFIG, name: 'x' },
    })
    expect(Reflect.get({}, 'polluted')).toBeUndefined()
  })

  it('refuses an over-long name', () => {
    expect(
      reject(
        encodeRaw({
          v: 1,
          name: 'x'.repeat(61),
          config: DEFAULT_LAUNCH_CONFIG,
        }),
      ),
    ).toMatchObject({ detail: 'name' })
  })
})

describe('toTypeScript', () => {
  it.each(shapes.map((c) => [c.curveShape, c] as const))(
    'the %s snippet carries exactly the builder input the tool compiles',
    (shape, config: LaunchConfig) => {
      const code = toTypeScript(config)
      expect(code).toContain(`const parameters = ${BUILDER_BY_SHAPE[shape]}(`)
      const start = code.indexOf('(', code.indexOf('const parameters')) + 1
      const json = code.slice(start, code.indexOf('})\n', start) + 1)
      expect(json).not.toContain('curveShape')
      // Read the snippet's input back through the typed reader, then compile it the way the tool does.
      const fromSnippet = readLaunchConfig(
        { ...JSON.parse(json), curveShape: shape },
        'snippet',
      )
      expect(fromSnippet).toEqual(config)
      const a = compileLaunchConfig(fromSnippet)
      const b = compileLaunchConfig(config)
      expect(
        a.ok &&
          b.ok &&
          JSON.stringify(a.parameters) === JSON.stringify(b.parameters),
      ).toBe(true)
    },
  )
})
