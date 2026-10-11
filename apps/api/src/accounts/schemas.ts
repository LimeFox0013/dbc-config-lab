import { PublicKey } from '@solana/web3.js'
import { z } from 'zod'
import {
  MAX_KEY_LABEL_LENGTH,
  MAX_SIGN_IN_MESSAGE_LENGTH,
  MAX_SIGNATURE_LENGTH,
  PlanId,
} from './constants'

const solanaAddress = z.string().refine((value) => {
  try {
    return PublicKey.isOnCurve(new PublicKey(value).toBytes())
  } catch {
    return false
  }
})

/** Request bodies, validated before anything else runs. */
export const ChallengeBody = z.object({ address: solanaAddress })
export const SignInBody = z.object({
  message: z.string().min(1).max(MAX_SIGN_IN_MESSAGE_LENGTH),
  signature: z.string().min(1).max(MAX_SIGNATURE_LENGTH),
})
export const CreateKeyBody = z.object({
  label: z.string().trim().min(1).max(MAX_KEY_LABEL_LENGTH),
})
export const PaymentBody = z.object({ plan: z.literal(PlanId.Pro) })
