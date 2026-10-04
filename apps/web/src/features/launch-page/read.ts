import { PublicKey } from '@solana/web3.js'
import type { Connection } from '@solana/web3.js'
import { COMMITMENT } from '../../core/config-deploy'
import { readPartnerBranding } from '../../core/partner-branding'
import { readRoyaltySplit } from '../../core/preset-royalty'
import type { SolanaNetwork } from '../../core/shared'
import { loadOnChainConfig } from '../onchain-config'
import { LaunchPageStatus } from './constants'
import type { LaunchPageRead } from './types'

/** Reads a config, then its operator's branding and royalty split; the last two are extras that never fail the read. */
export const readLaunchPage = async (
  connection: Connection,
  network: SolanaNetwork,
  address: string,
): Promise<LaunchPageRead> => {
  const result = await loadOnChainConfig(connection, network, address)
  if (!result.ok)
    return {
      status: LaunchPageStatus.Refused,
      rejection: result.rejection,
      detail: result.detail,
    }
  const royalty = await readRoyaltySplit(
    connection,
    new PublicKey(result.loaded.feeClaimer),
    COMMITMENT,
  ).catch(() => null)
  // A royalty vault cannot publish branding; its operator's wallet can.
  const branding = await readPartnerBranding(
    connection,
    royalty?.deployer ?? result.loaded.feeClaimer,
  ).catch(() => null)
  return {
    status: LaunchPageStatus.Ready,
    config: result.loaded,
    branding,
    royalty,
  }
}
