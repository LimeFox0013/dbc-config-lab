import { readFileSync } from 'node:fs'
import { Keypair } from '@solana/web3.js'
import { SIGNER_TEXT, SignerEnv, SignerStatus } from './constants'
import { readSpend } from './ledger'
import { keypairFileSchema, signingPolicySchema } from './schemas'
import type { SignerSetup, SigningPolicy } from './types'
import { createTaskQueue, spendFileFor } from './utils'

type Loaded<T> = { ok: true; value: T } | { ok: false; reason: string }

const readJson = (file: string): unknown =>
  JSON.parse(readFileSync(file, 'utf8'))

/** The keypair in a file; the reason never repeats the file's contents. */
const loadKeypair = (file: string): Loaded<Keypair> => {
  try {
    const bytes = keypairFileSchema.safeParse(readJson(file))
    return bytes.success
      ? { ok: true, value: Keypair.fromSecretKey(Uint8Array.from(bytes.data)) }
      : { ok: false, reason: SIGNER_TEXT.unreadableKeypair }
  } catch {
    return { ok: false, reason: SIGNER_TEXT.unreadableKeypair }
  }
}

const loadPolicy = (file: string): Loaded<SigningPolicy> => {
  try {
    const policy = signingPolicySchema.safeParse(readJson(file))
    return policy.success
      ? { ok: true, value: policy.data }
      : {
          ok: false,
          reason: `${SIGNER_TEXT.unreadablePolicy}: ${policy.error.issues
            .map(
              (issue) =>
                `${issue.path.join('.') || SIGNER_TEXT.policyRoot} ${issue.message}`,
            )
            .join('; ')}`,
        }
  } catch {
    return { ok: false, reason: `${SIGNER_TEXT.unreadablePolicy}.` }
  }
}

/**
 * The local signer the environment asks for: off when neither variable is set, refused
 * (with the reason) when only one is set or either file is unreadable or invalid, so a
 * mistyped policy never signs under rules the owner did not write.
 */
export const signerFromEnv = (
  env: Record<string, string | undefined>,
): SignerSetup => {
  const keypairFile = env[SignerEnv.Keypair]
  const policyFile = env[SignerEnv.Policy]
  if (!keypairFile && !policyFile) return { status: SignerStatus.Off }
  if (!keypairFile || !policyFile)
    return { status: SignerStatus.Refused, reason: SIGNER_TEXT.onlyOneVariable }
  const keypair = loadKeypair(keypairFile)
  if (!keypair.ok)
    return { status: SignerStatus.Refused, reason: keypair.reason }
  const policy = loadPolicy(policyFile)
  if (!policy.ok) return { status: SignerStatus.Refused, reason: policy.reason }
  const spendFile = spendFileFor(policyFile)
  if (!readSpend(spendFile).ok)
    return {
      status: SignerStatus.Refused,
      reason: `${SIGNER_TEXT.unreadableSpend} (${spendFile}).`,
    }
  return {
    status: SignerStatus.On,
    signer: {
      keypair: keypair.value,
      policy: policy.value,
      spendFile,
      queue: createTaskQueue(),
    },
  }
}
