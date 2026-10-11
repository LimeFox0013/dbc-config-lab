import { connectionFor } from '@dbc-config-lab/core/core/config-deploy'
import {
  QUOTE_TOKENS,
  wholeQuoteTokens,
} from '@dbc-config-lab/core/core/quote-token'
import { formatAmount } from '@dbc-config-lab/core/core/shared'
import type { OnChainConfig } from '@dbc-config-lab/core/features/onchain-config'
import { fetchRealLaunches } from '@dbc-config-lab/core/features/real-launches'
import type { RealLaunchesResult } from '@dbc-config-lab/core/features/real-launches'
import type { LaunchpadTermsValues } from './types'

/** `network:address` — one real config, wherever it is listed. */
export const onChainKey = (
  config: Pick<OnChainConfig, 'network' | 'configAddress'>,
): string => `${config.network}:${config.configAddress}`

/** The list with `item` first; an earlier item with the same key is dropped. */
export const prependReplacing = <T>(
  list: readonly T[],
  item: T,
  keyOf: (value: T) => string,
): T[] => [item, ...list.filter((existing) => keyOf(existing) !== keyOf(item))]

/** A listed item's label for an id, or the id itself once the list no longer has it. */
export const labelById = <T extends { id: string }>(
  items: readonly T[],
  id: T['id'],
  labelOf: (item: T) => string,
): string => {
  const found = items.find((item) => item.id === id)
  return found ? labelOf(found) : id
}

/** How the real launches on a config went, read on the config's own network. */
export const readRealLaunches = (
  config: OnChainConfig,
): Promise<RealLaunchesResult> =>
  fetchRealLaunches(
    connectionFor(config.network),
    config.configAddress,
    config.parameters,
    config.quoteToken,
  )

/** The terms a builder judges a launchpad by: graduation threshold, its token, creator share. */
export const launchpadTermsValues = (
  config: OnChainConfig,
): LaunchpadTermsValues => ({
  threshold: formatAmount(
    wholeQuoteTokens(
      config.parameters.migrationQuoteThreshold,
      config.quoteToken,
    ),
  ),
  symbol: QUOTE_TOKENS[config.quoteToken].symbol,
  creator: config.parameters.creatorTradingFeePercentage,
})

/** The number an input or select now holds; not a number for any other element. */
export const numberFromEvent = (event: Event): number => {
  const target = event.target
  if (target instanceof HTMLInputElement) return target.valueAsNumber
  if (target instanceof HTMLSelectElement) return Number(target.value)
  return Number.NaN
}

/** The value a select now holds; null when the event did not come from a select. */
export const selectedValue = (event: Event): string | null =>
  event.target instanceof HTMLSelectElement ? event.target.value : null
