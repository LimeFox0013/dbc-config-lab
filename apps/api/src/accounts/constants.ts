import type { Finality } from '@solana/web3.js'
import type { PaidPlanTerms, PlanLimits } from './types'

/** `service-plans`: the plans an account can be on. */
export enum PlanId {
  Free = 'free',
  Pro = 'pro',
}

/** `service-plans`: every plan's limits, in one place (owner decision 2026-10-05). */
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  [PlanId.Free]: { dailyCalls: 200, watches: 3 },
  [PlanId.Pro]: { dailyCalls: 20_000, watches: 50 },
}

/** `usdc-plan-payment`: what a paid plan costs, per period. */
export const PAID_PLAN_TERMS: Partial<Record<PlanId, PaidPlanTerms>> = {
  [PlanId.Pro]: { priceUsdc: 49, periodDays: 30 },
}

export const DAY_MS = 24 * 60 * 60 * 1000

/** `usdc-plan-payment`: how long an uncredited request keeps being checked in the background. */
export const OPEN_PAYMENT_WINDOW_MS = 7 * DAY_MS

/** `usdc-plan-payment`: uncredited requests checked per poller run at most, newest first. */
export const OPEN_PAYMENTS_PER_RUN = 50

/** `usdc-plan-payment`: how many recent transactions touching a reference are inspected for its transfer. */
export const REFERENCE_SIGNATURE_LIMIT = 20

/** `usdc-plan-payment`: only a finalized transfer credits a plan. */
export const PAYMENT_COMMITMENT: Finality = 'finalized'

/** `wallet-sign-in` */
export const SESSION_COOKIE = 'lab_session'
export const SESSION_COOKIE_PATH = '/'
export const SESSION_TTL_MS = 7 * DAY_MS
/** The session cookie is marked secure when the site is served over this protocol. */
export const SECURE_PROTOCOL = 'https:'
export const CHALLENGE_TTL_MS = 5 * 60 * 1000
export const SIGN_IN_STATEMENT = 'Sign in to DBC Config Lab.'
export const SIGN_IN_VERSION = '1'
/** Random bytes behind a session token and a sign-in nonce. */
export const TOKEN_BYTES = 32
export const NONCE_BYTES = 16
/** Request-body bounds for a signed sign-in message. */
export const MAX_SIGN_IN_MESSAGE_LENGTH = 2048
export const MAX_SIGNATURE_LENGTH = 128

/** `api-keys`: the one role every key gets, and the permission the MCP endpoint asks for. */
export const MCP_CALLER_ROLE = 'mcp-caller'
export const MCP_TOOL_ACCESS = 'mcp-tool-access'
export const KEY_EXTERNAL_SYSTEM = 'dbc-config-lab'
export const MAX_KEY_LABEL_LENGTH = 64

/** Configuration the service reads from its environment (`hosting-portability`). */
export enum AccountEnv {
  /** The site's origin: the sign-in message's domain and the only origin allowed to call with a session. */
  SiteOrigin = 'DBC_LAB_SITE_ORIGIN',
  /** `usdc-plan-payment`: the operator's receiving wallet. */
  PayRecipient = 'DBC_LAB_PAY_RECIPIENT',
  /** `usdc-plan-payment`: `mainnet-beta` (default) or `devnet`. */
  PayNetwork = 'DBC_LAB_PAY_NETWORK',
}

/** `usdc-plan-payment`: USDC's mint per network. */
export const USDC_MINT = {
  'mainnet-beta': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
} as const

export const USDC_DECIMALS = 6
export const PAYMENT_LABEL = 'DBC Config Lab'
/** The message a wallet shows for a plan's transfer request. */
export const PAYMENT_MESSAGE = (plan: string): string =>
  `${PAYMENT_LABEL} — ${plan} plan`

/** Readable refusals — the only text a caller ever gets back. */
export const ACCOUNT_TEXT = {
  invalidSignIn:
    'The sign-in could not be verified. Request a new challenge and sign again.',
  notSignedIn: 'Sign in with your wallet first.',
  keyNotFound: 'No such key on this account.',
  invalidKey: 'This API key is not valid. It may have been revoked.',
  paymentsOff: 'Paid plans are not available on this deployment yet.',
  unknownPlan: 'There is no such paid plan.',
  paymentNotFound: 'No such payment request on this account.',
  badRequest: 'The request is missing a field or has one in the wrong form.',
} as const
