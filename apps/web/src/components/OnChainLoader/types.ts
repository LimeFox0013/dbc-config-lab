import type { RealLaunchesResult } from '../../features/real-launches'

/** The real launches on the last loaded config: being read, or what the read gave. */
export type RealLaunchesState =
  { loading: true } | { loading: false; result: RealLaunchesResult }
