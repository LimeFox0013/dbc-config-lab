import { beforeAll, describe, expect, it } from 'vitest'
import { reportFindings } from '../config-report'
import { configTerms } from '../../core/config-deploy'
import { loadLaunchpads } from '../launchpad-economics'
import type { LaunchpadRecord } from '../launchpad-economics'
import { FEED_DIRECTORY, FEED_INDEX_FILE, feedFiles, NotCarried } from '.'
import type { FeedEntry, FeedFile, FeedIndex } from '.'

const SAMPLE = 12

let records: LaunchpadRecord[] = []
let files: FeedFile[] = []
let index: FeedIndex
let entries: FeedEntry[] = []

beforeAll(async () => {
  records = (await loadLaunchpads()).slice(0, SAMPLE)
  files = feedFiles(records)
  const indexFile = files.find(
    (f) => f.path === `${FEED_DIRECTORY}/${FEED_INDEX_FILE}`,
  )
  if (!indexFile) throw new Error('No index file')
  index = JSON.parse(indexFile.content)
  entries = files
    .filter((f) => f !== indexFile)
    .map((f): FeedEntry => JSON.parse(f.content))
})

describe('launchpad report feed', () => {
  it('publishes one entry per launchpad and an index over all of them', () => {
    expect(files).toHaveLength(SAMPLE + 1)
    expect(index.launchpads.map((l) => l.configAddress)).toEqual(
      records.map((r) => r.config.configAddress),
    )
    index.launchpads.forEach((l) =>
      expect(files.map((f) => `/${f.path}`)).toContain(l.entry),
    )
  })

  it('states when its chain data was read and what it does not carry', () => {
    expect(index.takenAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    entries.forEach((entry) => {
      expect(entry.record.takenAt).toBe(index.takenAt)
      expect(entry.notCarried).toEqual(Object.values(NotCarried))
      expect(entry).not.toHaveProperty('branding')
      expect(entry).not.toHaveProperty('real')
    })
  })

  it('reports the same risks the report page finds', () => {
    records.forEach((record, i) => {
      const { parameters, quoteToken } = record.config
      const expected = reportFindings(
        parameters,
        configTerms(parameters, quoteToken),
      )
      expect(entries[i]?.risks).toEqual(JSON.parse(JSON.stringify(expected)))
      expect(index.launchpads[i]?.risks).toEqual(expected.map((f) => f.risk))
    })
  })

  it('points each entry at its report page on mainnet', () => {
    entries.forEach((entry) =>
      expect(entry.reportPage).toBe(
        `/config/${entry.configAddress}?network=mainnet-beta`,
      ),
    )
  })
})
