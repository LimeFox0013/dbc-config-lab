import { createHash } from 'node:crypto'
import { labUrl } from '@dbc-config-lab/core/mcp'
import type { ParsedTransactionWithMeta } from '@solana/web3.js'
import bs58 from 'bs58'
import nacl from 'tweetnacl'
import { networkOf } from '../utils'
import {
  AccountEnv,
  DAY_MS,
  PAID_PLAN_TERMS,
  PAYMENT_LABEL,
  PAYMENT_MESSAGE,
  PLAN_LIMITS,
  PlanId,
  SIGN_IN_STATEMENT,
  SIGN_IN_VERSION,
  USDC_DECIMALS,
  USDC_MINT,
} from './constants'
import type {
  Account,
  ApiKeyFields,
  ApiKeyView,
  PaymentRequestView,
  PaymentRow,
  PlanLimits,
  SignInFields,
  SolanaPayRequest,
} from './types'

/**
 * `wallet-sign-in`: the Sign-In With Solana message the service issues and the
 * wallet signs verbatim with `solana:signMessage` (a wallet's own `solana:signIn`
 * writes its own text, so it cannot sign this exact challenge).
 */
export const buildSignInMessage = (fields: SignInFields): string =>
  [
    `${fields.domain} wants you to sign in with your Solana account:`,
    fields.address,
    '',
    SIGN_IN_STATEMENT,
    '',
    `Version: ${SIGN_IN_VERSION}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${fields.issuedAt}`,
    `Expiration Time: ${fields.expirationTime}`,
  ].join('\n')

const FIELD_LINE = /^(Nonce|Issued At|Expiration Time): (.+)$/
const HEADER_SUFFIX = ' wants you to sign in with your Solana account:'

/** The checked fields of a Sign-In With Solana message, or null when it is not one. */
export const parseSignInMessage = (message: string): SignInFields | null => {
  const lines = message.split('\n')
  const [header, address] = lines
  if (!header?.endsWith(HEADER_SUFFIX) || !address) return null
  const values = new Map(
    lines
      .map((line) => FIELD_LINE.exec(line))
      .filter((match): match is RegExpExecArray => match !== null)
      .map((match) => [match[1], match[2]]),
  )
  const nonce = values.get('Nonce')
  const issuedAt = values.get('Issued At')
  const expirationTime = values.get('Expiration Time')
  if (!nonce || !issuedAt || !expirationTime) return null
  return {
    domain: header.slice(0, -HEADER_SUFFIX.length),
    address,
    nonce,
    issuedAt,
    expirationTime,
  }
}

/** Whether `signature` (base58) is `address`'s ed25519 signature over `message`. */
export const verifyWalletSignature = (
  message: string,
  signature: string,
  address: string,
): boolean => {
  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      bs58.decode(signature),
      bs58.decode(address),
    )
  } catch {
    return false
  }
}

/** Sessions and API keys are stored as this hash, never as the token itself. */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex')

/** One cookie's value from a `Cookie` header. */
export const readCookie = (
  header: string | undefined,
  name: string,
): string | undefined =>
  header
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1)

/** `service-plans`: the plan an account is on now — a lapsed paid plan is free. */
export const effectivePlan = (
  account: Pick<Account, 'paidPlan' | 'planEndsAt'>,
  now: Date,
): PlanId =>
  account.paidPlan === PlanId.Pro &&
  account.planEndsAt !== null &&
  account.planEndsAt > now
    ? PlanId.Pro
    : PlanId.Free

/** `service-plans`: the limits of the plan an account is on now. */
export const planLimits = (
  account: Pick<Account, 'paidPlan' | 'planEndsAt'>,
  now: Date,
): PlanLimits => PLAN_LIMITS[effectivePlan(account, now)]

/** `usdc-plan-payment`: a paid period runs on from the current end while active, else from now. */
export const extendedPlanEnd = (
  currentEnd: Date | null,
  now: Date,
  days: number,
): Date =>
  new Date(Math.max(currentEnd?.getTime() ?? 0, now.getTime()) + days * DAY_MS)

/** Whole USDC as base units. */
export const usdcBaseUnits = (usdc: number): bigint =>
  BigInt(Math.round(usdc * 10 ** USDC_DECIMALS))

/** Base units as whole USDC. */
export const usdcFromBaseUnits = (units: bigint): number =>
  Number(units) / 10 ** USDC_DECIMALS

export const isPaidPlan = (plan: string): plan is PlanId =>
  plan in PAID_PLAN_TERMS

/** A Solana Pay transfer request (https://docs.solanapay.com/spec). */
export const solanaPayUrl = (request: SolanaPayRequest): string => {
  const query = new URLSearchParams({
    amount: String(request.amountUsdc),
    'spl-token': request.mint,
    reference: request.reference,
    label: request.label,
    message: request.message,
  })
  return `solana:${request.recipient}?${query.toString()}`
}

/** `usdc-plan-payment`: what an account sees about one of its payment requests. */
export const paymentView = (
  payment: PaymentRow,
  account: Pick<Account, 'planEndsAt'>,
): PaymentRequestView => {
  const amountUsdc = usdcFromBaseUnits(payment.amount)
  return {
    reference: payment.reference,
    plan: isPaidPlan(payment.plan) ? payment.plan : PlanId.Free,
    amountUsdc,
    recipient: payment.recipient,
    network: payment.network,
    url: solanaPayUrl({
      recipient: payment.recipient,
      amountUsdc,
      mint: USDC_MINT[networkOf(payment.network)],
      reference: payment.reference,
      label: PAYMENT_LABEL,
      message: PAYMENT_MESSAGE(payment.plan),
    }),
    credited: payment.creditedAt !== null,
    planEndsAt: account.planEndsAt?.toISOString() ?? null,
  }
}

/**
 * Whether a finalized transaction moved at least the requested USDC to the
 * recipient and carries the request's reference — by token balance change, so
 * it holds whatever instruction layout the wallet used.
 */
export const paysInFull = (
  transaction: ParsedTransactionWithMeta,
  payment: Pick<PaymentRow, 'reference' | 'recipient' | 'amount'>,
  mint: string,
): boolean => {
  const meta = transaction.meta
  if (!meta || meta.err) return false
  const carriesReference = transaction.transaction.message.accountKeys.some(
    (key) => key.pubkey.toBase58() === payment.reference,
  )
  if (!carriesReference) return false
  const balance = (balances: typeof meta.postTokenBalances): bigint =>
    (balances ?? [])
      .filter(
        (entry) => entry.owner === payment.recipient && entry.mint === mint,
      )
      .reduce((sum, entry) => sum + BigInt(entry.uiTokenAmount.amount), 0n)
  return (
    balance(meta.postTokenBalances) - balance(meta.preTokenBalances) >=
    payment.amount
  )
}

/** `api-keys`: what an account sees about one of its keys — never the key itself. */
export const toKeyView = (key: ApiKeyFields): ApiKeyView => ({
  id: key.id,
  label: key.externalRef,
  prefix: key.keyPrefix,
  createdAt: key.createdAt.toISOString(),
  lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
})

/** The site's origin (`hosting-portability`: configurable, the lab's own address by default). */
export const siteOrigin = (): string =>
  new URL(process.env[AccountEnv.SiteOrigin] ?? labUrl()).origin

/** The domain a sign-in message must name: the site the wallet signs on. */
export const signInDomain = (): string => new URL(siteOrigin()).host
