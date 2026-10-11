import BN from 'bn.js'
import { describe, expect, it } from 'vitest'
import { MAX_BASIS_POINT, ONE_Q64 } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { deltaBinId, trackerAfterSwap, trackerBeforeSwap } from '.'
import type { TrackerSettings, TrackerState } from '.'

/** One bin is a 1% step in sqrt price. */
const BIN_STEP = ONE_Q64.divn(100)

const SETTINGS: TrackerSettings = {
  binStepU128: BIN_STEP,
  filterPeriod: 10,
  decayPeriod: 120,
  reductionFactor: 5000,
  maxVolatilityAccumulator: 1_000_000,
}

const tracker = (state: Partial<TrackerState> = {}): TrackerState => ({
  lastUpdateTimestamp: new BN(1000),
  sqrtPriceReference: ONE_Q64,
  volatilityAccumulator: new BN(40_000),
  volatilityReference: new BN(0),
  ...state,
})

/** `steps` 1% bins above the Q64 unit price. */
const sqrtPriceUp = (steps: number): BN => ONE_Q64.add(BIN_STEP.muln(steps))

describe('deltaBinId', () => {
  it('counts the bins crossed, doubled, whichever way the price moved', () => {
    expect(deltaBinId(BIN_STEP, ONE_Q64, sqrtPriceUp(3)).toNumber()).toBe(6)
    expect(deltaBinId(BIN_STEP, sqrtPriceUp(3), ONE_Q64).toNumber()).toBe(6)
    expect(deltaBinId(BIN_STEP, ONE_Q64, ONE_Q64).toNumber()).toBe(0)
  })
})

describe('trackerBeforeSwap', () => {
  it('leaves the tracker alone within the filter period', () => {
    const state = tracker()
    expect(
      trackerBeforeSwap(state, SETTINGS, sqrtPriceUp(5), new BN(1005)),
    ).toBe(state)
  })

  it('moves the reference price and decays the volatility within the decay period', () => {
    const next = trackerBeforeSwap(
      tracker(),
      SETTINGS,
      sqrtPriceUp(5),
      new BN(1050),
    )
    expect(next.sqrtPriceReference.eq(sqrtPriceUp(5))).toBe(true)
    // Half of the accumulator survives at a 5000 bps reduction factor.
    expect(next.volatilityReference.toNumber()).toBe(
      (40_000 * SETTINGS.reductionFactor) / MAX_BASIS_POINT,
    )
  })

  it('drops the volatility after a pause past the decay period', () => {
    const next = trackerBeforeSwap(
      tracker(),
      SETTINGS,
      sqrtPriceUp(5),
      new BN(2000),
    )
    expect(next.volatilityReference.isZero()).toBe(true)
  })
})

describe('trackerAfterSwap', () => {
  it('accumulates the move from the reference price and stamps the time', () => {
    const next = trackerAfterSwap(
      tracker({ volatilityReference: new BN(1000) }),
      SETTINGS,
      ONE_Q64,
      sqrtPriceUp(2),
      new BN(1100),
    )
    expect(next.volatilityAccumulator.toNumber()).toBe(
      1000 + 4 * MAX_BASIS_POINT,
    )
    expect(next.lastUpdateTimestamp.toNumber()).toBe(1100)
  })

  it('caps the accumulator at the settings’ maximum', () => {
    const next = trackerAfterSwap(
      tracker(),
      { ...SETTINGS, maxVolatilityAccumulator: 5000 },
      ONE_Q64,
      sqrtPriceUp(50),
      new BN(1100),
    )
    expect(next.volatilityAccumulator.toNumber()).toBe(5000)
  })

  it('keeps the old timestamp when the swap crossed no bin', () => {
    const next = trackerAfterSwap(
      tracker(),
      SETTINGS,
      ONE_Q64,
      ONE_Q64,
      new BN(1100),
    )
    expect(next.lastUpdateTimestamp.toNumber()).toBe(1000)
  })
})
