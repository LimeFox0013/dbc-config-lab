import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js'
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { compileLaunchConfig } from '../launch-config'
import {
  COMMITMENT,
  NATIVE_SOL_MINT,
  RPC_ENDPOINT_BY_NETWORK,
} from './constants'
import type { SolanaNetwork } from './constants'
import type { DeployRequest, PrepareResult } from './types'
import { summarizeDeployment } from './utils'

export { CHAIN_BY_NETWORK, SolanaChain, SolanaNetwork } from './constants'
export type {
  DeployRequest,
  DeploySummary,
  PreparedDeployment,
  PrepareResult,
} from './types'
import { errorMessage } from '../shared'
export { explorerAddressUrl, explorerTransactionUrl } from './utils'

export const connectionFor = (network: SolanaNetwork): Connection =>
  new Connection(RPC_ENDPOINT_BY_NETWORK[network], COMMITMENT)

/**
 * Builds the create-config transaction for the connected wallet, signs it with a fresh
 * one-off config key, and dry-runs it on the target network so a failing deployment is
 * reported before the user is ever asked to sign.
 */
export const prepareDeployment = async (
  connection: Connection,
  request: DeployRequest,
): Promise<PrepareResult> => {
  const compiled = compileLaunchConfig(request.config)
  if (!compiled.ok) return { ok: false, reason: compiled.reason }

  const configKey = Keypair.generate()
  try {
    const transaction = await new DynamicBondingCurveClient(
      connection,
      COMMITMENT,
    ).partner.createConfig({
      ...compiled.parameters,
      config: configKey.publicKey,
      feeClaimer: request.owner,
      leftoverReceiver: request.owner,
      quoteMint: NATIVE_SOL_MINT,
      payer: request.owner,
    })
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash(COMMITMENT)
    transaction.feePayer = request.owner
    transaction.recentBlockhash = blockhash
    transaction.partialSign(configKey)

    const dryRun = await connection.simulateTransaction(
      new VersionedTransaction(transaction.compileMessage()),
      {
        sigVerify: false,
        commitment: COMMITMENT,
      },
    )
    if (dryRun.value.err) {
      const logs = dryRun.value.logs?.slice(-3).join(' | ') ?? ''
      return {
        ok: false,
        reason:
          `Dry run failed: ${JSON.stringify(dryRun.value.err)} ${logs}`.trim(),
      }
    }

    return {
      ok: true,
      deployment: {
        transaction,
        lastValidBlockHeight,
        summary: summarizeDeployment(
          request.config,
          compiled.parameters,
          request.network,
          request.owner,
          configKey.publicKey,
        ),
      },
    }
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  }
}
