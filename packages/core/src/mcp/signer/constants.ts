import { ComputeBudgetProgram, PublicKey, SystemProgram } from '@solana/web3.js'
import {
  DAMM_V2_PROGRAM_ID,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
  METAPLEX_PROGRAM_ID,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { DYNAMIC_FEE_SHARING_PROGRAM_ID } from '@meteora-ag/dynamic-fee-sharing-sdk'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '../../core/shared'
import { ToolName } from '../constants'

/** Environment variables that turn signing on; both must name readable files. */
export enum SignerEnv {
  /** A Solana keypair JSON file (64 numbers), as `solana-keygen new` writes it. */
  Keypair = 'DBC_LAB_KEYPAIR',
  /** The owner's JSON signing policy. */
  Policy = 'DBC_LAB_POLICY',
}

export enum SignerStatus {
  /** Neither variable is set: previews only. */
  Off = 'off',
  On = 'on',
  /** Signing was asked for but cannot start safely: previews only, with the reason. */
  Refused = 'refused',
}

/** Bytes in a Solana keypair file: the 32-byte secret seed followed by the public key. */
export const KEYPAIR_BYTES = 64
export const MAX_BYTE = 255

/** Signing tools change chain state and spend the signer's SOL. */
export const SIGNING = {
  readOnlyHint: false,
  destructiveHint: true,
  openWorldHint: true,
} as const

/** The tools that sign and send; a policy names which of them may run. */
export const SIGNING_TOOLS = [
  ToolName.ExecuteDeployConfig,
  ToolName.ExecuteCloneConfig,
  ToolName.ExecutePartnerBranding,
  ToolName.ExecuteTokenLaunch,
  ToolName.ExecuteFeeClaim,
] as const

/** Programs a signed transaction may touch when the policy lists none of its own. */
export const DEFAULT_ALLOWED_PROGRAMS: readonly string[] = [
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
  DAMM_V2_PROGRAM_ID,
  DYNAMIC_FEE_SHARING_PROGRAM_ID,
  SystemProgram.programId,
  new PublicKey(TOKEN_PROGRAM_ID),
  new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID),
  ComputeBudgetProgram.programId,
  METAPLEX_PROGRAM_ID,
].map((program) => program.toBase58())

/** Characters of an ISO timestamp that name its UTC day (`YYYY-MM-DD`). */
export const ISO_DAY_LENGTH = 10

/** The day's spend is kept next to the policy, in a file named after it with this suffix. */
export const SPEND_FILE_SUFFIX = '.spend.json'
/** A new spend record is written here first, then moved over the old one. */
export const SPEND_DRAFT_SUFFIX = '.tmp'

/** The policy rule an action broke, named as the policy file names it. */
export enum PolicyRule {
  Actions = 'actions',
  Networks = 'networks',
  Programs = 'programs',
  MaxSolPerAction = 'maxSolPerAction',
  MaxSolPerDay = 'maxSolPerDay',
}

/** Agent- and owner-facing wording for the signer. */
export const SIGNER_TEXT = {
  nothingSigned: 'Nothing was signed or sent.',
  onlyOneVariable: `Signing needs both ${SignerEnv.Keypair} and ${SignerEnv.Policy}; only one is set.`,
  unreadableKeypair: `${SignerEnv.Keypair} does not name a readable Solana keypair file (a JSON array of 64 numbers).`,
  unreadablePolicy: `${SignerEnv.Policy} does not name a readable JSON policy file`,
  unreadableSpend:
    'The day-spend file next to the policy is not a spend record, so the daily limit cannot be checked; fix or remove it',
  noBlockhash: 'The transaction carries no recent blockhash.',
  balanceUnknown:
    "The simulation did not report the signing wallet's balance, so the spend cannot be checked.",
  sendRefused:
    'The network refused the signed transaction, so it was not sent:',
  sentButFailed: 'Sent, but the transaction failed or could not be confirmed:',
  spendCounted:
    "Its simulated spend counts towards today's limit, since it may still have landed",
  policyRoot: '(root)',
  feeUnknown: 'The network could not price the transaction fee.',
  toolPolicyNote:
    'Signed and sent by the local signing wallet, which is the owner, only when the action, network, SOL per action and per day, and every program the transaction touches are within the owner’s policy; anything outside it is refused with the rule it broke and nothing is signed. Builds exactly what the matching preview_ tool dry-runs.',
  signingOff:
    'Signing tools are off: the server runs with previews only. Reason:',
  sentNote:
    'Signed by the local signing wallet within its policy and sent. The figures are from the simulation just before signing.',
} as const
