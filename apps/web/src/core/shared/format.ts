/** Every number the UI shows goes through one of these, so the same quantity reads the same everywhere. */
const LOCALE = 'en-US'

const solFormat = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const signedSolFormat = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
})
const shareFormat = new Intl.NumberFormat(LOCALE, {
  style: 'percent',
  maximumFractionDigits: 0,
})
const percentChangeFormat = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
})
const countFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })
const amountFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 })
const multipleFormat = new Intl.NumberFormat(LOCALE, {
  maximumSignificantDigits: 3,
})

/** SOL amount with two decimals, e.g. "0.61". */
export const formatSol = (sol: number): string => solFormat.format(sol)

/** Signed SOL change with two decimals, e.g. "+1.04" or "-4.76". */
export const formatSolChange = (sol: number): string =>
  signedSolFormat.format(sol)

/** A 0–1 share as a whole percent, e.g. "35%". */
export const formatShare = (share: number): string => shareFormat.format(share)

/** A signed percent change, rounded, e.g. "+12%" or "-3%". */
export const formatPercentChange = (percent: number): string =>
  `${percentChangeFormat.format(percent)}%`

/** A count or a whole number of tokens, grouped, e.g. "21,045". */
export const formatCount = (count: number): string => countFormat.format(count)

/** An amount with at most two decimals, e.g. "85.54". */
export const formatAmount = (amount: number): string =>
  amountFormat.format(amount)

/** A price multiple to three significant digits, e.g. "1.23". */
export const formatMultiple = (multiple: number): string =>
  multipleFormat.format(multiple)
