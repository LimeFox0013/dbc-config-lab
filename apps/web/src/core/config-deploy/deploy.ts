import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js'
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { compileLaunchConfig } from '../launch-config'
import {
  royaltyRejection,
  RoyaltyRejection,
  royaltyVault,
} from '../preset-royalty'
import { QUOTE_TOKENS } from '../quote-token'
import { COMMITMENT } from './constants'
import { rpcEndpointFor, websocketEndpointFor } from './utils'
import type {
  DeployRequest,
  ParametersDeployRequest,
  PreparedTransaction,
  PrepareResult,
} from './types'
import { fitsOneTransaction, summarizeDeployment } from './utils'
import { errorMessage } from '../shared'
import type { SolanaNetwork } from '../shared'

export const connectionFor = (network: SolanaNetwork): Connection => {
  const endpoint = rpcEndpointFor(network)
  // Set explicitly: web3.js would otherwise move a same-origin endpoint's websocket to
  // the next port.
  return new Connection(endpoint, {
    commitment: COMMITMENT,
    wsEndpoint: websocketEndpointFor(endpoint),
  })
}

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
    royalty: request.royalty,
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
  const quoteMint = new PublicKey(
    QUOTE_TOKENS[request.quoteToken].mints[request.network],
  )
  try {
    const rejection =
      request.royalty &&
      royaltyRejection(request.royalty, request.parameters, request.owner)
    if (rejection) return { ok: false, reason: rejection }
    const vault = request.royalty
      ? await royaltyVault(connection, {
          configKey,
          quoteMint,
          deployer: request.owner,
          royalty: request.royalty,
          commitment: COMMITMENT,
        })
      : null
    const configTransaction = await new DynamicBondingCurveClient(
      connection,
      COMMITMENT,
    ).partner.createConfig({
      ...request.parameters,
      config: configKey.publicKey,
      // With a royalty the fee-sharing vault claims the fees and splits them.
      feeClaimer: vault?.vault ?? request.owner,
      leftoverReceiver: request.owner,
      quoteMint,
      payer: request.owner,
    })
    // The vault and the config it serves are created together or not at all.
    const transaction = vault
      ? new Transaction().add(
          ...vault.instructions,
          ...configTransaction.instructions,
        )
      : configTransaction
    if (vault && !fitsOneTransaction(transaction, request.owner))
      return { ok: false, reason: RoyaltyRejection.TooLarge }
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
          vault?.split ?? null,
        ),
      },
    }
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  }
}
