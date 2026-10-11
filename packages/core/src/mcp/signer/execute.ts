import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { VersionedTransaction } from '@solana/web3.js'
import type { Connection, PublicKey } from '@solana/web3.js'
import {
  COMMITMENT,
  dryRunFailure,
  explorerTransactionUrl,
} from '../../core/config-deploy'
import type { PreparedTransaction } from '../../core/config-deploy'
import { errorMessage } from '../../core/shared'
import type { SolanaNetwork } from '../../core/shared'
import type { ActionContext, BuildResult } from '../builders'
import type { ToolName } from '../constants'
import { rpcConnection, toolRefusal, toolResult } from '../utils'
import { SIGNER_TEXT } from './constants'
import { readSpend, recordSpend } from './ledger'
import type { PolicySigner, SimulatedEffect } from './types'
import {
  actionViolation,
  effectViolation,
  lamportsToSol,
  programsInvoked,
  utcDay,
  violationText,
} from './utils'

export interface ExecuteRequest {
  tool: ToolName
  network: SolanaNetwork
  build: (context: ActionContext) => Promise<BuildResult>
}

/** A built transaction that passed its simulation, with what it would do to the signer. */
interface Simulated {
  prepared: PreparedTransaction
  blockhash: string
  effect: SimulatedEffect
}

type Simulation =
  { ok: true; simulated: Simulated } | { ok: false; reason: string }

type Sent =
  | { sent: true; signature: string; error: string | null }
  | { sent: false; error: string }

const unsigned = (reason: string): CallToolResult =>
  toolRefusal(`${reason}\n${SIGNER_TEXT.nothingSigned}`)

/**
 * Simulates a transaction as the signer would send it and reads what it costs the
 * signer — the balance it loses plus the fee — and every program it calls.
 */
const simulate = async (
  connection: Connection,
  prepared: PreparedTransaction,
  signer: PublicKey,
): Promise<Simulation> => {
  const blockhash = prepared.transaction.recentBlockhash
  if (!blockhash) return { ok: false, reason: SIGNER_TEXT.noBlockhash }
  const message = prepared.transaction.compileMessage()
  const [before, simulation, fee] = await Promise.all([
    connection.getBalance(signer, COMMITMENT),
    connection.simulateTransaction(new VersionedTransaction(message), {
      sigVerify: false,
      commitment: COMMITMENT,
      accounts: { encoding: 'base64', addresses: [signer.toBase58()] },
      innerInstructions: true,
    }),
    connection.getFeeForMessage(message, COMMITMENT),
  ])
  const { err, logs, accounts, innerInstructions } = simulation.value
  if (err) return { ok: false, reason: dryRunFailure(err, logs) }
  if (fee.value === null) return { ok: false, reason: SIGNER_TEXT.feeUnknown }
  if (!accounts || accounts.length === 0)
    return { ok: false, reason: SIGNER_TEXT.balanceUnknown }
  // A null entry is an account the transaction closed: none of its balance is left.
  const after = accounts[0]?.lamports ?? 0
  return {
    ok: true,
    simulated: {
      prepared,
      blockhash,
      effect: {
        lamportsSpent: Math.max(0, before - after) + fee.value,
        programs: programsInvoked(prepared.transaction, innerInstructions),
      },
    },
  }
}

/** Sends one signed transaction and waits for it: whether it went out, and the error if it failed or could not be confirmed. */
const sendAndConfirm = async (
  connection: Connection,
  { prepared, blockhash }: Simulated,
): Promise<Sent> => {
  const sending = await connection
    .sendRawTransaction(prepared.transaction.serialize(), {
      preflightCommitment: COMMITMENT,
    })
    .then(
      (signature) => ({ ok: true as const, signature }),
      (error: unknown) => ({ ok: false as const, error: errorMessage(error) }),
    )
  if (!sending.ok) return { sent: false, error: sending.error }
  const { signature } = sending
  try {
    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight: prepared.lastValidBlockHeight,
      },
      COMMITMENT,
    )
    return {
      sent: true,
      signature,
      error: confirmation.value.err
        ? JSON.stringify(confirmation.value.err)
        : null,
    }
  } catch (error) {
    return { sent: true, signature, error: errorMessage(error) }
  }
}

/**
 * Build → simulate → check every rule → sign → send → confirm → record spend. Every
 * transaction of the action is simulated and checked before any is signed; a refusal
 * names the rule broken. A sent transaction's simulated spend is recorded even when
 * its confirmation fails, since it may still land.
 */
const runAction = async (
  signer: PolicySigner,
  { tool, network, build }: ExecuteRequest,
): Promise<CallToolResult> => {
  const { keypair, policy, spendFile } = signer
  const early = actionViolation(policy, tool, network)
  if (early) return toolRefusal(violationText(early))

  const connection = rpcConnection(network)
  const result = await build({ connection, network, owner: keypair.publicKey })
  if (!result.ok) return result.result
  const { built } = result

  const simulations = await Promise.all(
    [built.prepared].map((prepared) =>
      simulate(connection, prepared, keypair.publicKey),
    ),
  )
  const failed = simulations.find(
    (simulation): simulation is Extract<Simulation, { ok: false }> =>
      !simulation.ok,
  )
  if (failed) return unsigned(failed.reason)
  const simulated = simulations.flatMap((simulation) =>
    simulation.ok ? [simulation.simulated] : [],
  )

  const ledger = readSpend(spendFile)
  if (!ledger.ok)
    return unsigned(`${SIGNER_TEXT.unreadableSpend} (${spendFile}).`)
  const day = utcDay(new Date())
  const spentBefore = ledger.record[day] ?? 0
  const effects = simulated.map((item) => item.effect)
  const broken = effectViolation(policy, effects, spentBefore)
  if (broken) return toolRefusal(violationText(broken))

  simulated.forEach((item) => item.prepared.transaction.partialSign(keypair))

  const sent: { signature: string; lamports: number }[] = []
  let record = ledger.record
  for (const item of simulated) {
    const outcome = await sendAndConfirm(connection, item)
    if (!outcome.sent)
      return toolRefusal(`${SIGNER_TEXT.sendRefused} ${outcome.error}`)
    record = recordSpend(spendFile, record, day, item.effect.lamportsSpent)
    sent.push({
      signature: outcome.signature,
      lamports: item.effect.lamportsSpent,
    })
    if (outcome.error)
      return toolRefusal(
        `${SIGNER_TEXT.sentButFailed} ${outcome.signature}: ${outcome.error}. ${SIGNER_TEXT.spendCounted}`,
      )
  }

  const spent = sent.reduce((total, item) => total + item.lamports, 0)
  return toolResult({
    sent: true,
    network,
    signer: keypair.publicKey.toBase58(),
    signatures: sent.map((item) => item.signature),
    explorer: sent.map((item) =>
      explorerTransactionUrl(item.signature, network),
    ),
    created: built.created,
    summary: built.summary,
    spentSol: lamportsToSol(spent),
    // Exact; the SOL figures are rounded like every other tool figure.
    spentLamports: spent,
    spentTodaySol: lamportsToSol(record[day] ?? 0),
    note: SIGNER_TEXT.sentNote,
  })
}

/** Runs one signing action at a time, so concurrent calls never share a day-spend check. */
export const executeAction = (
  signer: PolicySigner,
  request: ExecuteRequest,
): Promise<CallToolResult> => signer.queue(() => runAction(signer, request))
