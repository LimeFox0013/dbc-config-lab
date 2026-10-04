// The constants module, not the router itself: building the router needs a browser.
import {
  LAUNCH_PAGE_PATH,
  NETWORK_QUERY_KEY,
  REPORT_PAGE_PATH,
} from '../../router/constants'
import { SolanaNetwork } from '../../core/shared'

/** The page's path within the app: anyone with it sees the same config, read from chain. */
export const launchPagePath = (
  configAddress: string,
  network: SolanaNetwork,
): string =>
  `${LAUNCH_PAGE_PATH}/${encodeURIComponent(configAddress)}?${NETWORK_QUERY_KEY}=${network}`

/** The config's report page: read-only, for anyone deciding whether to buy or launch on it. */
export const reportPagePath = (
  address: string,
  network: SolanaNetwork,
): string =>
  `${REPORT_PAGE_PATH}/${encodeURIComponent(address)}?${NETWORK_QUERY_KEY}=${network}`

const NETWORKS: readonly string[] = Object.values(SolanaNetwork)
const isNetwork = (value: unknown): value is SolanaNetwork =>
  typeof value === 'string' && NETWORKS.includes(value)

/** Real launchpads live on mainnet, so a missing or unknown network means mainnet. */
export const networkFromQuery = (value: unknown): SolanaNetwork =>
  isNetwork(value) ? value : SolanaNetwork.Mainnet
