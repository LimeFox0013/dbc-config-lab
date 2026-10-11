import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import type { ParsedInnerInstruction, Transaction } from '@solana/web3.js'
import type { SolanaNetwork } from '../../core/shared'
import type { ToolName } from '../constants'
import {
  DEFAULT_ALLOWED_PROGRAMS,
  ISO_DAY_LENGTH,
  PolicyRule,
  SIGNER_TEXT,
  SPEND_FILE_SUFFIX,
} from './constants'
import type {
  PolicyViolation,
  SigningPolicy,
  SimulatedEffect,
  TaskQueue,
} from './types'

/** The UTC day a spend counts towards, as the spend file keys it. */
export const utcDay = (now: Date): string =>
  now.toISOString().slice(0, ISO_DAY_LENGTH)

export const lamportsToSol = (lamports: number): number =>
  lamports / LAMPORTS_PER_SOL

const solToLamports = (sol: number): number =>
  Math.round(sol * LAMPORTS_PER_SOL)

/** Where the day's spend for a policy file is kept: next to it. */
export const spendFileFor = (policyFile: string): string =>
  `${policyFile}${SPEND_FILE_SUFFIX}`

/** The programs a signed transaction may touch under this policy. */
export const allowedPrograms = (policy: SigningPolicy): readonly string[] =>
  policy.programs ?? DEFAULT_ALLOWED_PROGRAMS

/** Every program a transaction calls: its own instructions and what they call in turn. */
export const programsInvoked = (
  transaction: Transaction,
  inner: ParsedInnerInstruction[] | null | undefined,
): string[] => [
  ...new Set([
    ...transaction.instructions.map((instruction) =>
      instruction.programId.toBase58(),
    ),
    ...(inner ?? []).flatMap((group) =>
      group.instructions.map((instruction) => instruction.programId.toBase58()),
    ),
  ]),
]

/** The rule an action breaks before anything is built: one the policy does not list, or a network it does not. */
export const actionViolation = (
  policy: SigningPolicy,
  tool: ToolName,
  network: SolanaNetwork,
): PolicyViolation | null => {
  if (!policy.actions.some((action) => action === tool))
    return {
      rule: PolicyRule.Actions,
      detail: `${tool} is not one of the allowed actions (${policy.actions.join(', ')})`,
    }
  if (!policy.networks.includes(network))
    return {
      rule: PolicyRule.Networks,
      detail: `${network} is not one of the allowed networks (${policy.networks.join(', ')})`,
    }
  return null
}

const formatSol = (lamports: number): string => `${lamportsToSol(lamports)} SOL`

/**
 * The rule a built, simulated action breaks: a program the policy does not allow, more
 * SOL than one action may spend, or more than the day still allows. Checks every
 * transaction of the action together, so none is signed unless all pass.
 */
export const effectViolation = (
  policy: SigningPolicy,
  effects: readonly SimulatedEffect[],
  spentTodayLamports: number,
): PolicyViolation | null => {
  const allowed = allowedPrograms(policy)
  const foreign = [
    ...new Set(effects.flatMap((effect) => effect.programs)),
  ].filter((program) => !allowed.includes(program))
  if (foreign.length > 0)
    return {
      rule: PolicyRule.Programs,
      detail: `the transaction touches programs the policy does not allow: ${foreign.join(', ')}`,
    }
  const actionLamports = effects.reduce(
    (total, effect) => total + effect.lamportsSpent,
    0,
  )
  const perAction = solToLamports(policy.maxSolPerAction)
  if (actionLamports > perAction)
    return {
      rule: PolicyRule.MaxSolPerAction,
      detail: `the action would spend ${formatSol(actionLamports)}, over the ${formatSol(perAction)} allowed per action`,
    }
  const perDay = solToLamports(policy.maxSolPerDay)
  if (spentTodayLamports + actionLamports > perDay)
    return {
      rule: PolicyRule.MaxSolPerDay,
      detail: `the action would spend ${formatSol(actionLamports)} after ${formatSol(spentTodayLamports)} today (UTC), over the ${formatSol(perDay)} allowed per day`,
    }
  return null
}

/** How a refusal reads to the agent: the rule broken, how, and that nothing was signed. */
export const violationText = ({ rule, detail }: PolicyViolation): string =>
  `Refused by the signing policy (${rule}): ${detail}. ${SIGNER_TEXT.nothingSigned}`

/** A queue that runs each task after the previous one settles. */
export const createTaskQueue = (): TaskQueue => {
  let tail: Promise<unknown> = Promise.resolve()
  return <T>(task: () => Promise<T>): Promise<T> => {
    const next = tail.then(task, task)
    tail = next.catch(() => undefined)
    return next
  }
}
