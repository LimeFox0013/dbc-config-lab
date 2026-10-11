import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { SPEND_DRAFT_SUFFIX } from './constants'
import { spendRecordSchema } from './schemas'
import type { SpendRecord } from './types'

type ReadSpend = { ok: true; record: SpendRecord } | { ok: false }

/** The spend kept so far; no file yet means nothing spent. */
export const readSpend = (spendFile: string): ReadSpend => {
  if (!existsSync(spendFile)) return { ok: true, record: {} }
  try {
    const parsed = spendRecordSchema.safeParse(
      JSON.parse(readFileSync(spendFile, 'utf8')),
    )
    return parsed.success ? { ok: true, record: parsed.data } : { ok: false }
  } catch {
    return { ok: false }
  }
}

/** Adds a spend to its day, writing the whole record at once so a crash never leaves half a file. */
export const recordSpend = (
  spendFile: string,
  record: SpendRecord,
  day: string,
  lamports: number,
): SpendRecord => {
  const next = { ...record, [day]: (record[day] ?? 0) + lamports }
  const draft = `${spendFile}${SPEND_DRAFT_SUFFIX}`
  writeFileSync(draft, `${JSON.stringify(next, null, 2)}\n`)
  renameSync(draft, spendFile)
  return next
}
