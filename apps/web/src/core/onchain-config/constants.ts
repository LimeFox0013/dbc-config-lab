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
