/** Where the feed is published, relative to the site root. */
export const FEED_DIRECTORY = 'data/launchpads'
export const FEED_INDEX_FILE = 'index.json'

/** Bumped when the feed's data shape changes. */
export const FEED_VERSION = 1

/** Parts of the page's report a feed entry does not carry; also stated in each entry. */
export enum NotCarried {
  /** The operator's self-published name, website and logo: not read at build time. */
  Branding = 'branding',
  /** A royalty vault's split of the fee claimer's fees: not read at build time. */
  RoyaltySplit = 'royalty-split',
  /** The page reads every pool live; the feed carries the snapshot's record instead. */
  LiveRealLaunches = 'live-real-launches',
}
