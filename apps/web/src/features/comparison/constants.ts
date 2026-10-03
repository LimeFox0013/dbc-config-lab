/** Bounds on user-entered scenario sizes, keeping a browser-side run interactive. */
export const SCENARIO_LIMITS = {
  minTraders: 0,
  maxTraders: 500,
  maxSeed: 2 ** 31 - 1,
} as const

/** Precision kept when turning a ratio of Q64 prices into a float multiple. */
export const MULTIPLE_PRECISION = 1_000_000_000
