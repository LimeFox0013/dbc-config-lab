/**
 * Writes the launchpad report feed into the built site (`dist/data/launchpads/`): one JSON
 * report per launchpad in the shipped snapshot, and an index over them. Runs after
 * `vite build`; offline — everything comes from the snapshot and the simulator.
 *
 *   npx tsx apps/web/scripts/build-report-feed.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadLaunchpads } from '../src/features/launchpad-economics'
import { FEED_DIRECTORY, feedFiles } from '../src/features/report-feed'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const files = feedFiles(await loadLaunchpads())
files.forEach(({ path, content }) => {
  const target = join(dist, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
})
console.log(`Report feed: ${files.length} files in dist/${FEED_DIRECTORY}`)
