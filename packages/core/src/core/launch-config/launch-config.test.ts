import { describe, expect, it } from 'vitest'
import { BaseFeeMode } from '@meteora-ag/dynamic-bonding-curve-sdk'
import {
  compileLaunchConfig,
  CURVE_SHAPE_ORDER,
  curveOf,
  DEFAULT_LAUNCH_CONFIG,
  DEFAULT_MARKET_CAPS,
  defaultCurve,
  FLAT_SCHEDULE,
  geometricWeights,
  LAUNCH_PRESETS,
  LIQUIDITY_WEIGHT_SEGMENTS,
  parametersRejection,
  parseLaunchConfig,
  priceCurve,
  scheduleOf,
  serializeLaunchConfig,
  weightGrowthOf,
  withCurve,
  withQuoteToken,
  withSchedule,
} from '.'
import { CurveShape } from './constants'
import { QUOTE_TOKENS, QuoteToken, REFERENCE_USD_PER_SOL } from '../quote-token'

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

describe('parametersRejection', () => {
  it('accepts compiled parameters and words what the program would refuse', () => {
    const compiled = compileLaunchConfig(DEFAULT_LAUNCH_CONFIG)
    if (!compiled.ok) throw new Error(compiled.reason)
    expect(parametersRejection(compiled.parameters)).toBeNull()
    expect(
      parametersRejection({
        ...compiled.parameters,
        creatorTradingFeePercentage: 150,
      }),
    ).toEqual(expect.any(String))
  })
})

describe('liquidity weights', () => {
  it('grows each segment by the same factor, and reads that factor back', () => {
    const weights = geometricWeights(1.5)
    expect(weights).toHaveLength(LIQUIDITY_WEIGHT_SEGMENTS)
    expect(weights.slice(0, 3)).toEqual([1, 1.5, 2.25])
    expect(weightGrowthOf(weights)).toBe(1.5)
  })

  it('reads a flat growth from too few or zero weights', () => {
    expect(weightGrowthOf([])).toBe(1)
    expect(weightGrowthOf([0, 3])).toBe(1)
  })
})

describe('curves', () => {
  it.each(CURVE_SHAPE_ORDER)(
    'the default %s curve compiles and reads back from its config',
    (shape) => {
      const config = withCurve(DEFAULT_LAUNCH_CONFIG, defaultCurve(shape))
      expect(compileLaunchConfig(config)).toMatchObject({ ok: true })
      expect(curveOf(config)).toEqual(defaultCurve(shape))
    },
  )

  it('re-prices thresholds and market caps between quote tokens', () => {
    expect(
      priceCurve(
        defaultCurve(CurveShape.Standard),
        QuoteToken.Sol,
        QuoteToken.Usdc,
      ),
    ).toMatchObject({ migrationQuoteThreshold: 12_750 })
    expect(
      priceCurve(
        defaultCurve(CurveShape.MarketCap),
        QuoteToken.Sol,
        QuoteToken.Usdc,
      ),
    ).toMatchObject({
      initialMarketCap:
        DEFAULT_MARKET_CAPS.initialMarketCap * REFERENCE_USD_PER_SOL,
      migrationMarketCap:
        DEFAULT_MARKET_CAPS.migrationMarketCap * REFERENCE_USD_PER_SOL,
    })
  })
})

describe('fee schedules', () => {
  it('replaces only the schedule, one fee period per second, and reads it back', () => {
    const schedule = {
      mode: BaseFeeMode.FeeSchedulerExponential,
      startingFeeBps: 5000,
      endingFeeBps: 100,
      windowSeconds: 10,
    } as const
    const config = withSchedule(DEFAULT_LAUNCH_CONFIG, schedule)
    expect(config.fee.baseFeeParams).toEqual({
      baseFeeMode: BaseFeeMode.FeeSchedulerExponential,
      feeSchedulerParam: {
        startingFeeBps: 5000,
        endingFeeBps: 100,
        numberOfPeriod: 10,
        totalDuration: 10,
      },
    })
    expect({ ...config, fee: DEFAULT_LAUNCH_CONFIG.fee }).toEqual(
      DEFAULT_LAUNCH_CONFIG,
    )
    expect(scheduleOf(config)).toEqual(schedule)
  })

  it('reads the default config as the flat schedule', () => {
    expect(scheduleOf(DEFAULT_LAUNCH_CONFIG)).toEqual(FLAT_SCHEDULE)
  })

  it('has no editable schedule under the rate limiter', () => {
    expect(
      scheduleOf({
        ...DEFAULT_LAUNCH_CONFIG,
        fee: {
          ...DEFAULT_LAUNCH_CONFIG.fee,
          baseFeeParams: {
            baseFeeMode: BaseFeeMode.RateLimiter,
            rateLimiterParam: {
              baseFeeBps: 100,
              feeIncrementBps: 10,
              referenceAmount: 1,
              maxLimiterDuration: 10,
            },
          },
        },
      }),
    ).toBeNull()
  })
})
