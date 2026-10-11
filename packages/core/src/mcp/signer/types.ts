import type { Keypair } from '@solana/web3.js'
import type { z } from 'zod'
import type { PolicyRule, SignerStatus } from './constants'
import type { signingPolicySchema, spendRecordSchema } from './schemas'

export type SigningPolicy = z.infer<typeof signingPolicySchema>

export type SpendRecord = z.infer<typeof spendRecordSchema>

/** Runs tasks one after another, so two actions never check the same day's spend at once. */
export type TaskQueue = <T>(task: () => Promise<T>) => Promise<T>

/** The local signer: its wallet, the owner's policy and where the day's spend is kept. */
export interface PolicySigner {
  keypair: Keypair
  policy: SigningPolicy
  spendFile: string
  queue: TaskQueue
}

/** Whether the environment turns signing on, and if it tried and failed, why. */
export type SignerSetup =
  | { status: SignerStatus.Off }
  | { status: SignerStatus.On; signer: PolicySigner }
  | { status: SignerStatus.Refused; reason: string }

/** What one transaction does to the signing wallet, read from its simulation. */
export interface SimulatedEffect {
  /** SOL leaving the signer, fee included, in lamports. */
  lamportsSpent: number
  /** Every program the transaction invokes, directly or from another program. */
  programs: string[]
}

/** The first policy rule an action breaks, and how. */
export interface PolicyViolation {
  rule: PolicyRule
  detail: string
}
