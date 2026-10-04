import type { ConfigReport, ReportRisk } from '../config-report'
import type { LaunchpadSummary } from '../launchpad-economics'
import type { NotCarried } from './constants'

/** One launchpad's full entry: the report's terms, risks and typical launch, plus its snapshot record. */
export type FeedEntry = Pick<
  ConfigReport,
  | 'version'
  | 'configAddress'
  | 'network'
  | 'feeClaimer'
  | 'terms'
  | 'risks'
  | 'simulated'
> & {
  /** Real-launch figures as of the snapshot. */
  record: LaunchpadSummary
  notCarried: NotCarried[]
  /** The site path of this config's report page. */
  reportPage: string
}

export interface FeedIndexEntry {
  configAddress: string
  risks: ReportRisk[]
  pullableLiquidityPercent: number
  launches: number
  graduationRate: number
  partnerIncomeMedian: number
  /** The site path of this launchpad's full entry. */
  entry: string
  reportPage: string
}

export interface FeedIndex {
  version: number
  /** When the snapshot's chain data was read, YYYY-MM-DD. */
  takenAt: string | null
  launchpads: FeedIndexEntry[]
}

/** A file the feed publishes, at a path relative to the site root. */
export interface FeedFile {
  path: string
  content: string
}
