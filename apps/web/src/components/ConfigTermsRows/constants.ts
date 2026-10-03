/** Units a duration is shown in, largest first, in seconds. */
export const DURATION_UNITS = [
  { unit: 'days', seconds: 86_400 },
  { unit: 'hours', seconds: 3_600 },
  { unit: 'minutes', seconds: 60 },
  { unit: 'seconds', seconds: 1 },
] as const

/** Who holds a share of graduation liquidity; also its copy key. */
export enum LiquidityHolder {
  Partner = 'partner',
  Creator = 'creator',
}
