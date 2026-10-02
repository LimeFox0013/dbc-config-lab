import { SolanaNetwork } from '../../core/config-deploy'
import { WALLET_ICON_PREFIX } from './constants'

export const isSafeWalletIcon = (icon: string): boolean =>
  icon.startsWith(WALLET_ICON_PREFIX)

/** Mainnet spends real SOL, so it needs an explicit acknowledgement; devnet does not. */
export const canPrepare = (
  network: SolanaNetwork,
  mainnetAcknowledged: boolean,
): boolean => network !== SolanaNetwork.Mainnet || mainnetAcknowledged
