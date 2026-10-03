import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from '@solana/web3.js'
import type { Transaction } from '@solana/web3.js'
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { compileLaunchConfig } from '../launch-config'
import { QUOTE_TOKENS } from '../quote-token'
import { COMMITMENT, RPC_ENDPOINT_BY_NETWORK } from './constants'
import type {
  DeployRequest,
  ParametersDeployRequest,
  PreparedTransaction,
  PrepareResult,
} from './types'
import { summarizeDeployment } from './utils'

import { errorMessage } from '../shared'
import type { SolanaNetwork } from '../shared'

export const connectionFor = (network: SolanaNetwork): Connection =>
  new Connection(RPC_ENDPOINT_BY_NETWORK[network], COMMITMENT)

/**
 * Makes a built transaction ready for the user's wallet: the wallet pays, one-off keys
 * add their signatures, and a dry run on the target network reports a failing
 * transaction before the user is ever asked to sign it.
 */
export const readyForWallet = async (
  connection: Connection,
  transaction: Transaction,
  payer: PublicKey,
  oneOffSigners: Keypair[],
): Promise<
  { ok: true; prepared: PreparedTransaction } | { ok: false; reason: string }
> => {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash(COMMITMENT)
  transaction.feePayer = payer
  transaction.recentBlockhash = blockhash
  oneOffSigners.forEach((signer) => transaction.partialSign(signer))

  const dryRun = await connection.simulateTransaction(
    new VersionedTransaction(transaction.compileMessage()),
    { sigVerify: false, commitment: COMMITMENT },
  )
  if (dryRun.value.err) {
    const logs = dryRun.value.logs?.slice(-3).join(' | ') ?? ''
    return {
      ok: false,
      reason:
        `Dry run failed: ${JSON.stringify(dryRun.value.err)} ${logs}`.trim(),
    }
  }
  return { ok: true, prepared: { transaction, lastValidBlockHeight } }
}

/**
 * Builds the create-config transaction for a launch config: compiles it, then deploys the
 * parameters as `prepareParametersDeployment` does.
 */
export const prepareDeployment = async (
  connection: Connection,
  request: DeployRequest,
): Promise<PrepareResult> => {
  const compiled = compileLaunchConfig(request.config)
  if (!compiled.ok) return { ok: false, reason: compiled.reason }
  return prepareParametersDeployment(connection, {
    parameters: compiled.parameters,
    quoteToken: compiled.quoteToken,
    network: request.network,
    owner: request.owner,
  })
}

/**
 * Builds the create-config transaction for the connected wallet, signs it with a fresh
 * one-off config key, and dry-runs it on the target network so a failing deployment is
 * reported before the user is ever asked to sign. The wallet pays, claims fees and
 * receives leftovers.
 */
export const prepareParametersDeployment = async (
  connection: Connection,
  request: ParametersDeployRequest,
): Promise<PrepareResult> => {
  const configKey = Keypair.generate()
  try {
    const transaction = await new DynamicBondingCurveClient(
      connection,
      COMMITMENT,
    ).partner.createConfig({
      ...request.parameters,
      config: configKey.publicKey,
      feeClaimer: request.owner,
      leftoverReceiver: request.owner,
      quoteMint: new PublicKey(
        QUOTE_TOKENS[request.quoteToken].mints[request.network],
      ),
      payer: request.owner,
    })
    const ready = await readyForWallet(connection, transaction, request.owner, [
      configKey,
    ])
    if (!ready.ok) return ready

    return {
      ok: true,
      deployment: {
        ...ready.prepared,
        summary: summarizeDeployment(
          request.parameters,
          request.quoteToken,
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
