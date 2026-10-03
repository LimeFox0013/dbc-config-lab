import { LAUNCH_PAGE_PATH, NETWORK_QUERY_KEY } from '../../router'
import { SolanaNetwork } from '../../core/shared'

/** The page's path within the app: anyone with it sees the same config, read from chain. */
export const launchPagePath = (
  configAddress: string,
  network: SolanaNetwork,
): string =>
  `${LAUNCH_PAGE_PATH}/${encodeURIComponent(configAddress)}?${NETWORK_QUERY_KEY}=${network}`

const NETWORKS: readonly string[] = Object.values(SolanaNetwork)
const isNetwork = (value: unknown): value is SolanaNetwork =>
  typeof value === 'string' && NETWORKS.includes(value)

/** Real launchpads live on mainnet, so a missing or unknown network means mainnet. */
export const networkFromQuery = (value: unknown): SolanaNetwork =>
  isNetwork(value) ? value : SolanaNetwork.Mainnet
