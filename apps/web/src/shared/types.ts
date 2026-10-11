/**
 * Copy parameters shared by every summary of a launchpad's terms. A type alias, not an
 * interface, so it can be passed to `t()` as named parameters.
 */
export type LaunchpadTermsValues = {
  /** Graduation threshold in whole quote tokens, formatted. */
  threshold: string
  symbol: string
  /** The creator's share of trading fees, in percent. */
  creator: number
}
