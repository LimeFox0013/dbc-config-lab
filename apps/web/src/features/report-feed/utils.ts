import { configReport, simulationOf, typicalLaunchRow } from '../config-report'
import { launchpadSummary } from '../launchpad-economics'
import type { LaunchpadRecord } from '../launchpad-economics'
import { reportPagePath } from '../launch-page'
import {
  FEED_DIRECTORY,
  FEED_INDEX_FILE,
  FEED_VERSION,
  NotCarried,
} from './constants'
import type { FeedEntry, FeedFile, FeedIndex, FeedIndexEntry } from './types'

const entryPath = (configAddress: string): string =>
  `${FEED_DIRECTORY}/${configAddress}.json`

/** A launchpad's feed entry: what the report page states, minus what is only read live. */
export const feedEntry = (record: LaunchpadRecord): FeedEntry => {
  const { config } = record
  const report = configReport(config, {
    branding: null,
    royalty: null,
    real: null,
    simulated: simulationOf(typicalLaunchRow(config, config.configAddress)),
  })
  return {
    version: FEED_VERSION,
    configAddress: report.configAddress,
    network: report.network,
    feeClaimer: report.feeClaimer,
    terms: report.terms,
    risks: report.risks,
    simulated: report.simulated,
    record: launchpadSummary(record),
    notCarried: Object.values(NotCarried),
    reportPage: reportPagePath(config.configAddress, config.network),
  }
}

const indexEntry = (entry: FeedEntry): FeedIndexEntry => ({
  configAddress: entry.configAddress,
  risks: entry.risks.map((finding) => finding.risk),
  pullableLiquidityPercent: entry.record.pullableLiquidityPercent,
  launches: entry.record.launches,
  graduationRate: entry.record.graduationRate,
  partnerIncomeMedian: entry.record.partnerIncomePerLaunch.median,
  entry: `/${entryPath(entry.configAddress)}`,
  reportPage: entry.reportPage,
})

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`

/** Every file the feed publishes: one entry per launchpad, and the index over them. */
export const feedFiles = (records: readonly LaunchpadRecord[]): FeedFile[] => {
  const entries = records.map(feedEntry)
  const index: FeedIndex = {
    version: FEED_VERSION,
    takenAt: records[0]?.takenAt ?? null,
    launchpads: entries.map(indexEntry),
  }
  return [
    ...entries.map((entry) => ({
      path: entryPath(entry.configAddress),
      content: json(entry),
    })),
    { path: `${FEED_DIRECTORY}/${FEED_INDEX_FILE}`, content: json(index) },
  ]
}
