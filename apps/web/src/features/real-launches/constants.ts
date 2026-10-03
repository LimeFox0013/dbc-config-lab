/** At most this many pools are read; above it an evenly spread sample is taken. */
export const POOL_SAMPLE_LIMIT = 500

/** Accounts per getMultipleAccountsInfo call — the RPC's own maximum. */
export const ACCOUNTS_PER_READ = 100

/** A pool counts as "got going" once its curve has collected this share of the threshold. */
export const TRACTION_SHARE = 0.1

/** The upper-quartile cut used for per-launch fee ranges. */
export const P75 = 0.75

export enum RealLaunchesRejection {
  NetworkError = 'network-error',
  NoPools = 'no-pools',
}
