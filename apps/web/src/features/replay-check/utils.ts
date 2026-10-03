import type { ReplayedLaunch, ReplayTotals } from './types'

export const replayTotals = (
  launches: readonly ReplayedLaunch[],
): ReplayTotals => ({
  launches: launches.length,
  curveSwaps: launches.reduce((sum, launch) => sum + launch.curveSwaps, 0),
  migrations: launches.filter((launch) => launch.migrated).length,
  migratedSwaps: launches.reduce(
    (sum, launch) => sum + (launch.migrated?.swaps ?? 0),
    0,
  ),
})

/** The replay command for one launch, with its migrated pool when it has one. */
export const replayCommand = (
  command: string,
  launch: ReplayedLaunch,
): string =>
  [command, launch.curvePool, launch.migrated?.pool]
    .filter((part): part is string => part !== undefined)
    .join(' ')
