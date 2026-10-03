/** Bounds on user-entered scenario sizes, keeping a browser-side run interactive. */
export const SCENARIO_LIMITS = {
  minTraders: 0,
  maxTraders: 500,
  maxSeed: 2 ** 31 - 1,
  /** Longest an adaptive sniper may wait; it is simulated second by second. */
  maxWaitSeconds: 3600,
  /** Outside market cap range for arbitrage traders, in SOL. */
  minFairMarketCapSol: 1,
  maxFairMarketCapSol: 1_000_000_000,
  /** Arbitrage traders check at most once a second, for at most a day. */
  minCheckEverySeconds: 1,
  maxArbitrageSeconds: 86_400,
  maxGapBps: 5000,
  /** Price checks across all arbitrage traders; beyond it they check less often. */
  maxArbitrageChecks: 50_000,
} as const

/** Precision kept when turning a ratio of Q64 prices into a float multiple. */
export const MULTIPLE_PRECISION = 1_000_000_000

/** Comparison entries built from a real config, or cloned from one, carry these id prefixes. */
export enum EntryIdPrefix {
  OnChain = 'on-chain',
  Clone = 'clone',
}
