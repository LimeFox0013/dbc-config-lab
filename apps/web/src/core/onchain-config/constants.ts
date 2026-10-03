/** A Solana address is this many bytes. */
export const ADDRESS_BYTES = 32

/** Byte offsets of the fields read by filters and checks, after the 8-byte discriminator. */
export const POOL_CONFIG_LAYOUT = {
  quoteMint: 8,
  feeClaimer: 40,
  leftoverReceiver: 72,
} as const

export const VIRTUAL_POOL_LAYOUT = {
  config: 72,
  creator: 104,
  isMigrated: 305,
} as const

/** Byte offsets inside a config's packed market-cap fee schedule for the graduated pool (little-endian). */
export const MARKET_CAP_SCHEDULER_LAYOUT = {
  numberOfPeriod: 0,
  sqrtPriceStepBps: 2,
  schedulerExpirationDuration: 4,
  reductionFactor: 8,
} as const
