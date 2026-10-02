/** Bounds on user-entered scenario sizes, keeping a browser-side run interactive. */
export const SCENARIO_LIMITS = {
  minTraders: 0,
  maxTraders: 500,
  maxSeed: 2 ** 31 - 1,
} as const
