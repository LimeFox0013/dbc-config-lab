import { describe, expect, it } from 'vitest'
import { compileLaunchConfig, LAUNCH_PRESETS } from '../../core/launch-config'
import { feeScheduleOf } from '../../core/launch-simulator'
import { QuoteToken } from '../../core/quote-token'
import { SolanaNetwork } from '../../core/shared'
import snapshot from './launchpads.json'
import {
  archetypeOf,
  CreatorShareBand,
  FeeShape,
  ThresholdBand,
  graduationRate,
  incomeForecast,
  launchpadRecords,
  LaunchpadSort,
  rankLaunchpads,
} from '.'
import type { Archetype } from '.'

const records = launchpadRecords(snapshot)
const storedOf = (address: string) =>
  snapshot.launchpads.find((l) => l.configAddress === address)

describe('launchpadRecords', () => {
  it('decodes snapshot configs offline as mainnet configs with their record', () => {
    expect(records.length).toBeGreaterThan(0)
    records.forEach((record) => {
      const stored = storedOf(record.config.configAddress)
      expect(record.config.network).toBe(SolanaNetwork.Mainnet)
      expect(record).toMatchObject({
        launches: stored?.launches,
        graduated: stored?.graduated,
        takenAt: snapshot.takenAt,
      })
      expect(record.graduated).toBeLessThanOrEqual(record.launches)
    })
  })

  it('credits the launchpad only the partner share of curve fees', () => {
    records.forEach((record) => {
      const stored = storedOf(record.config.configAddress)
      const share =
        (100 - record.config.parameters.creatorTradingFeePercentage) / 100
      expect(record.partnerIncomeMedian).toBeCloseTo(
        (stored?.medianCurveFees ?? 0) * share,
      )
      expect(record.partnerIncomeP75).toBeGreaterThanOrEqual(
        record.partnerIncomeMedian,
      )
    })
  })
})

describe('archetypeOf', () => {
  it('reads the fee shape and creator share of every built-in preset', () => {
    LAUNCH_PRESETS.forEach((preset) => {
      const compiled = compileLaunchConfig(preset.config)
      if (!compiled.ok) throw new Error(compiled.reason)
      const archetype = archetypeOf(compiled.parameters, compiled.quoteToken)
      expect(archetype.quoteToken).toBe(compiled.quoteToken)
      // A fee schedule that ends where it starts charges a flat fee.
      const schedule = feeScheduleOf(compiled.parameters)
      expect(archetype.feeShape).toBe(
        schedule === null
          ? FeeShape.RateLimiter
          : schedule.startingFeeBps === schedule.endingFeeBps
            ? FeeShape.Flat
            : FeeShape.Falling,
      )
      const creator = compiled.parameters.creatorTradingFeePercentage
      if (creator === 0)
        expect(archetype.creatorShare).toBe(CreatorShareBand.None)
      if (creator === 100)
        expect(archetype.creatorShare).toBe(CreatorShareBand.All)
    })
  })
})

describe('rankLaunchpads', () => {
  it('orders by the chosen measure, best first', () => {
    const byIncome = rankLaunchpads(records, {
      sort: LaunchpadSort.PartnerIncome,
      filter: {},
    })
    byIncome
      .slice(1)
      .forEach((record, i) =>
        expect(record.partnerIncomeMedian).toBeLessThanOrEqual(
          byIncome[i]?.partnerIncomeMedian ?? Infinity,
        ),
      )
    const byRate = rankLaunchpads(records, {
      sort: LaunchpadSort.GraduationRate,
      filter: {},
    })
    byRate
      .slice(1)
      .forEach((record, i) =>
        expect(graduationRate(record)).toBeLessThanOrEqual(
          byRate[i] ? graduationRate(byRate[i]) : Infinity,
        ),
      )
  })

  it('keeps only launchpads matching every set filter', () => {
    const filter = { quoteToken: QuoteToken.Sol, feeShape: FeeShape.Flat }
    const ranked = rankLaunchpads(records, {
      sort: LaunchpadSort.Launches,
      filter,
    })
    ranked.forEach((record) => expect(record.archetype).toMatchObject(filter))
    expect(ranked.length).toBe(
      records.filter(
        (r) =>
          r.archetype.quoteToken === filter.quoteToken &&
          r.archetype.feeShape === filter.feeShape,
      ).length,
    )
  })
})

describe('incomeForecast', () => {
  const sameTerms = (a: Archetype, b: Archetype) =>
    a.quoteToken === b.quoteToken &&
    a.thresholdBand === b.thresholdBand &&
    a.feeShape === b.feeShape &&
    a.creatorShare === b.creatorShare
  // The terms most snapshot launchpads share.
  const common = records
    .map((r) => r.archetype)
    .reduce((best, a) =>
      records.filter((r) => sameTerms(r.archetype, a)).length >
      records.filter((r) => sameTerms(r.archetype, best)).length
        ? a
        : best,
    )

  it('scales the middle half of comparable launchpads’ per-launch income', () => {
    const comparables = records.filter((r) => sameTerms(r.archetype, common))
    const one = incomeForecast(records, common, 1)
    const hundred = incomeForecast(records, common, 100)
    if (!one.ok || !hundred.ok) throw new Error('expected a range')
    const perLaunch = comparables.map((r) => r.partnerIncomeMedian)
    expect(one.low).toBeGreaterThanOrEqual(Math.min(...perLaunch))
    expect(one.high).toBeLessThanOrEqual(Math.max(...perLaunch))
    expect(one.low).toBeLessThanOrEqual(one.high)
    expect(hundred.low).toBeCloseTo(one.low * 100)
    expect(hundred).toMatchObject({
      launchpads: comparables.length,
      launches: comparables.reduce((sum, r) => sum + r.launches, 0),
      takenAt: snapshot.takenAt,
    })
  })

  it('gives no range when too few launchpads share the terms', () => {
    const rare: Archetype = {
      quoteToken: QuoteToken.Usdc,
      thresholdBand: ThresholdBand.Huge,
      feeShape: FeeShape.RateLimiter,
      creatorShare: CreatorShareBand.Majority,
    }
    expect(incomeForecast(records, rare, 100)).toMatchObject({ ok: false })
  })
})
