import type { AgenticAccountRow } from '@lf/agentic-account'
import type { Connection } from '@solana/web3.js'
import type { InferSelectModel } from 'drizzle-orm'
import type { Request } from 'express'
import type { accounts, payments } from '../db'
import type { PlanId } from './constants'

export type Account = InferSelectModel<typeof accounts>

export type PaymentRow = InferSelectModel<typeof payments>

export interface PlanLimits {
  /** Tool calls per UTC day. */
  dailyCalls: number
  watches: number
}

export interface PaidPlanTerms {
  /** Price per period, in whole USDC. */
  priceUsdc: number
  periodDays: number
}

/** The fields of a Sign-In With Solana message the service checks. */
export interface SignInFields {
  domain: string
  address: string
  nonce: string
  issuedAt: string
  expirationTime: string
}

/** A fresh sign-in challenge: the exact message the wallet signs, and its nonce. */
export interface SignInChallenge {
  message: string
  nonce: string
}

/** A successful sign-in: the session token (for the cookie only) and its account. */
export interface SignedInSession {
  token: string
  account: Account
}

/** What a signed-in account sees about itself. */
export interface AccountView {
  walletAddress: string
  plan: PlanId
  planEndsAt: string | null
  callsToday: number
  dailyCalls: number
  watches: number
}

export interface ApiKeyView {
  id: string
  label: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

/** The stored fields an API key's view is made from. */
export type ApiKeyFields = Pick<
  AgenticAccountRow,
  'id' | 'externalRef' | 'keyPrefix' | 'createdAt' | 'lastUsedAt'
>

/** A newly created key: the full key, returned this once only, and its view. */
export interface CreatedApiKey {
  key: string
  view: ApiKeyView
}

export interface PaymentRequestView {
  reference: string
  plan: PlanId
  amountUsdc: number
  recipient: string
  network: string
  /** A Solana Pay transfer request the wallet opens. */
  url: string
  credited: boolean
  planEndsAt: string | null
}

/** A Solana Pay transfer request's fields (https://docs.solanapay.com/spec). */
export interface SolanaPayRequest {
  recipient: string
  amountUsdc: number
  mint: string
  reference: string
  label: string
  message: string
}

/** The two chain reads a payment check needs. */
export type TransferReader = Pick<
  Connection,
  'getSignaturesForAddress' | 'getParsedTransaction'
>

/** A request that passed `SessionGuard`. */
export interface AccountRequest extends Request {
  account?: Account
}
