import type { PublicKey } from '@solana/web3.js'
import { BaseFeeMode } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { SOL_DECIMALS } from '../launch-config'
import type { LaunchConfig } from '../launch-config'
import { EXPLORER_BASE_URL, NATIVE_SOL_MINT, SolanaNetwork } from './constants'
import type { DeploySummary } from './types'

const clusterQuery = (network: SolanaNetwork): string =>
  network === SolanaNetwork.Mainnet ? '' : `?cluster=${network}`

export const explorerTransactionUrl = (
  signature: string,
  network: SolanaNetwork,
): string => `${EXPLORER_BASE_URL}/tx/${signature}${clusterQuery(network)}`

export const explorerAddressUrl = (
  address: string,
  network: SolanaNetwork,
): string => `${EXPLORER_BASE_URL}/address/${address}${clusterQuery(network)}`

const feeSchedule = (config: LaunchConfig) => {
  const base = config.fee.baseFeeParams
  return base.baseFeeMode === BaseFeeMode.RateLimiter
    ? {
        startingFeeBps: base.rateLimiterParam.baseFeeBps,
        endingFeeBps: base.rateLimiterParam.baseFeeBps,
        feeWindowSeconds: 0,
      }
    : {
        startingFeeBps: base.feeSchedulerParam.startingFeeBps,
        endingFeeBps: base.feeSchedulerParam.endingFeeBps,
        feeWindowSeconds: base.feeSchedulerParam.totalDuration,
      }
}

export const summarizeDeployment = (
  config: LaunchConfig,
  parameters: ConfigParameters,
  network: SolanaNetwork,
  owner: PublicKey,
  configAddress: PublicKey,
): DeploySummary => ({
  network,
  configAddress: configAddress.toBase58(),
  payer: owner.toBase58(),
  feeClaimer: owner.toBase58(),
  leftoverReceiver: owner.toBase58(),
  quoteMint: NATIVE_SOL_MINT.toBase58(),
  // Read from the compiled parameters: exact for every curve shape.
  migrationThresholdSol:
    Number(parameters.migrationQuoteThreshold.toString()) / 10 ** SOL_DECIMALS,
  ...feeSchedule(config),
})
