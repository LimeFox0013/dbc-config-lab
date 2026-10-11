import { createHmac } from 'node:crypto'
import { ADDRESS_CALLER_PREFIX } from './constants'

/** The UTC calendar day a moment falls on, as `YYYY-MM-DD`. */
export const utcDay = (moment: Date): string =>
  moment.toISOString().slice(0, 10)

/** A caller identified by network address — stored only as a keyed hash of it. */
export const addressCaller = (address: string, key: string): string =>
  `${ADDRESS_CALLER_PREFIX}${createHmac('sha256', key).update(address).digest('hex')}`
