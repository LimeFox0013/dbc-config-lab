import { describe, expect, it } from 'vitest'
import {
  compileLaunchConfig,
  DEFAULT_LAUNCH_CONFIG,
  LAUNCH_PRESETS,
  parseLaunchConfig,
  serializeLaunchConfig,
  withCurve,
  withQuoteToken,
} from '.'
import { CurveShape } from './constants'
import { QUOTE_TOKENS, QuoteToken } from '../quote-token'

describe('compileLaunchConfig', () => {
  it('compiles the default config into on-chain parameters', () => {
    const compiled = compileLaunchConfig(DEFAULT_LAUNCH_CONFIG)
    expect(compiled.ok).toBe(true)
  })

  it('rejects an invalid combination with a reason', () => {
    const compiled = compileLaunchConfig({
      ...DEFAULT_LAUNCH_CONFIG,
      fee: { ...DEFAULT_LAUNCH_CONFIG.fee, creatorTradingFeePercentage: 150 },
    })
    expect(compiled).toMatchObject({ ok: false })
    expect(compiled.ok ? '' : compiled.reason).not.toBe('')
  })
})

describe('serialization', () => {
  it('round-trips a config through a plain document without loss', () => {
    expect(
      parseLaunchConfig(serializeLaunchConfig(DEFAULT_LAUNCH_CONFIG)),
    ).toEqual(DEFAULT_LAUNCH_CONFIG)
  })
})

describe('LAUNCH_PRESETS', () => {
  it.each(LAUNCH_PRESETS.map((preset) => [preset.id, preset]))(
    '%s compiles',
    (_, preset) => {
      expect(compileLaunchConfig(preset.config)).toMatchObject({ ok: true })
    },
  )

  it('has unique ids', () => {
    expect(new Set(LAUNCH_PRESETS.map((preset) => preset.id)).size).toBe(
      LAUNCH_PRESETS.length,
    )
  })
})

describe('withQuoteToken', () => {
  it('prices the same launch in USDC at the reference rate, with USDC decimals', () => {
    const usdc = withQuoteToken(DEFAULT_LAUNCH_CONFIG, QuoteToken.Usdc)
    expect(usdc).toMatchObject({
      quoteToken: QuoteToken.Usdc,
      migrationQuoteThreshold: 12_750,
      token: { tokenQuoteDecimal: 6 },
    })
    const compiled = compileLaunchConfig(usdc)
    if (!compiled.ok) throw new Error(compiled.reason)
    expect(compiled.quoteToken).toBe(QuoteToken.Usdc)
    expect(compiled.parameters.migrationQuoteThreshold.toString()).toBe(
      String(12_750 * 10 ** QUOTE_TOKENS[QuoteToken.Usdc].decimals),
    )
  })

  it('converts market caps too, and converts back to the same config', () => {
    const marketCap = withCurve(DEFAULT_LAUNCH_CONFIG, {
      curveShape: CurveShape.MarketCap,
      initialMarketCap: 20,
      migrationMarketCap: 425,
    })
    const usdc = withQuoteToken(marketCap, QuoteToken.Usdc)
    expect(usdc).toMatchObject({
      initialMarketCap: 3000,
      migrationMarketCap: 63_750,
    })
    expect(withQuoteToken(usdc, QuoteToken.Sol)).toEqual(marketCap)
  })
})
