import type BN from 'bn.js'

/** The tracker state both programs keep per pool between swaps. */
export interface TrackerState {
  lastUpdateTimestamp: BN
  sqrtPriceReference: BN
  volatilityAccumulator: BN
  volatilityReference: BN
}

/** The dynamic-fee settings the tracker advances by. */
export interface TrackerSettings {
  binStepU128: BN
  filterPeriod: number
  decayPeriod: number
  reductionFactor: number
  maxVolatilityAccumulator: number
}
