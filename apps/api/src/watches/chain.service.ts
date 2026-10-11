import { Injectable } from '@nestjs/common'
import { PublicKey } from '@solana/web3.js'
import { rpcConnection } from '@dbc-config-lab/core/mcp'
import { configTerms } from '@dbc-config-lab/core/core/config-deploy'
import type { SolanaNetwork } from '@dbc-config-lab/core/core/shared'
import { reportFindings } from '@dbc-config-lab/core/features/config-report'
import { findEarnings } from '@dbc-config-lab/core/features/earnings'
import {
  LaunchPageStatus,
  readLaunchPage,
} from '@dbc-config-lab/core/features/launch-page'
import {
  countGraduatedPools,
  fetchRealLaunches,
  RealLaunchesRejection,
} from '@dbc-config-lab/core/features/real-launches'
import type { ConfigState, FeeWalletState } from './types'

/**
 * `watches`: the current state of a watched target, read with the same chain
 * readers the lab's report page and agent tools use. Throws when the target
 * cannot be read right now; the poller retries it on its next run.
 */
@Injectable()
export class ChainService {
  async configState(network: SolanaNetwork, address: string): Promise<ConfigState> {
    const connection = rpcConnection(network)
    const read = await readLaunchPage(connection, network, address)
    if (read.status !== LaunchPageStatus.Ready) throw new Error(read.rejection)
    const { config } = read
    const risks = reportFindings(
      config.parameters,
      configTerms(config.parameters, config.quoteToken),
    ).map((finding) => finding.risk)
    const real = await fetchRealLaunches(
      connection,
      config.configAddress,
      config.parameters,
      config.quoteToken,
    )
    // A config nobody has launched on yet is a valid baseline: its first pool is then a new pool.
    if (!real.ok && real.rejection === RealLaunchesRejection.NoPools)
      return { totalPools: 0, graduated: 0, risks }
    if (!real.ok) throw new Error(real.rejection)
    return {
      totalPools: real.launches.totalPools,
      graduated: await countGraduatedPools(connection, config.configAddress),
      risks,
    }
  }

  async feeWalletState(network: SolanaNetwork, owner: string): Promise<FeeWalletState> {
    const result = await findEarnings(rpcConnection(network), network, new PublicKey(owner))
    if (!result.ok) throw new Error(result.rejection)
    return {
      unclaimedSol: result.earnings.rows.reduce((sum, row) => sum + (row.valueSol ?? 0), 0),
    }
  }
}
