import type { LaunchpadRecord } from './types'
import { launchpadRecords } from './utils'

/** The snapshot is large, so it is fetched only when a screen first needs it. */
let loaded: Promise<LaunchpadRecord[]> | null = null
export const loadLaunchpads = (): Promise<LaunchpadRecord[]> => {
  loaded ??= import('./launchpads.json').then((module) =>
    launchpadRecords(module.default),
  )
  return loaded
}
