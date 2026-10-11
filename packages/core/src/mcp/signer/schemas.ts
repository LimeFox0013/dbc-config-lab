import { z } from 'zod'
import { parseAddress, SolanaNetwork } from '../../core/shared'
import { KEYPAIR_BYTES, MAX_BYTE, SIGNING_TOOLS } from './constants'

export const keypairFileSchema = z
  .array(z.number().int().min(0).max(MAX_BYTE))
  .length(KEYPAIR_BYTES)

const programId = z.string().refine((value) => parseAddress(value) !== null, {
  message: 'not a Solana address',
})

/** The limits an owner writes down for the local signer. Unknown fields are refused. */
export const signingPolicySchema = z
  .object({
    actions: z.array(z.enum(SIGNING_TOOLS)).min(1),
    networks: z.array(z.nativeEnum(SolanaNetwork)).min(1),
    maxSolPerAction: z.number().positive(),
    maxSolPerDay: z.number().positive(),
    programs: z.array(programId).min(1).optional(),
  })
  .strict()

/** Lamports spent per UTC day (`YYYY-MM-DD`). */
export const spendRecordSchema = z.record(
  z.string(),
  z.number().int().nonnegative(),
)
