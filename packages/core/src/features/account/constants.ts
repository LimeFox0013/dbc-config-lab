import { QUOTE_TOKENS, QuoteToken } from '../../core/quote-token'
import type { SolanaNetwork } from '../../core/shared'

/**
 * `hosting-portability`: where the hosted service answers when the site is built without
 * `VITE_DBC_LAB_API_URL`.
 */
export const DEFAULT_ACCOUNT_API_URL =
  'https://lf-aw-pod.dbc-lab-api.at.lime-fox.net'

/** `service-plans`: the plans an account can be on (the service's own ids). */
export enum PlanId {
  Free = 'free',
  Pro = 'pro',
}

/** `watches`: what can be watched (the service's own ids). */
export enum WatchKind {
  Config = 'config',
  FeeWallet = 'fee-wallet',
}

/** `watches`: the changes a watch reports (the service's own ids). */
export enum WatchEventType {
  NewPool = 'new-pool',
  Graduation = 'graduation',
  RisksChanged = 'risks-changed',
  FeesAboveThreshold = 'fees-above-threshold',
}

/** `webhooks`: where a delivery stands (the service's own ids). */
export enum DeliveryStatus {
  Pending = 'pending',
  Delivered = 'delivered',
  Failed = 'failed',
}

/** The service's routes, relative to its base URL. */
export enum AccountRoute {
  Challenge = '/auth/challenge',
  Session = '/auth/session',
  Account = '/account',
  Keys = '/account/keys',
  Payments = '/account/payments',
  Watches = '/account/watches',
  Events = '/account/events',
  Webhooks = '/account/webhooks',
  Deliveries = '/account/deliveries',
}

/** Appended to a webhook address's route to send it a test event. */
export const WEBHOOK_TEST_SUFFIX = '/test'

/** Characters of an ISO timestamp up to the minute (`YYYY-MM-DDTHH:MM`). */
export const ISO_MINUTE_LENGTH = 16

/** Shown for an event's missing state (a first sighting has no before). */
export const NO_STATE_TEXT = '—'

export enum HttpMethod {
  Get = 'GET',
  Post = 'POST',
  Patch = 'PATCH',
  Delete = 'DELETE',
}

/** Status the service answers with when no session cookie is valid. */
export const UNAUTHORIZED_STATUS = 401

/** Reported when the service could not be reached at all. */
export const NETWORK_FAILURE_STATUS = 0

/** `usdc-plan-payment`: USDC's mint on each network, and its decimals — the lab's USDC quote token. */
export const USDC_MINT: Record<SolanaNetwork, string> =
  QUOTE_TOKENS[QuoteToken.Usdc].mints
export const USDC_DECIMALS = QUOTE_TOKENS[QuoteToken.Usdc].decimals

/** The SPL Token program's `TransferChecked` instruction: tag, u64 amount, u8 decimals. */
export const TRANSFER_CHECKED_TAG = 12
export const TRANSFER_CHECKED_DATA_LENGTH = 10
export const TRANSFER_CHECKED_AMOUNT_OFFSET = 1
export const TRANSFER_CHECKED_DECIMALS_OFFSET = 9

/** How often, and how many times, a sent payment is re-checked before the page stops waiting. */
export const PAYMENT_POLL_INTERVAL_MS = 3_000
export const PAYMENT_POLL_ATTEMPTS = 40

/** `api-keys`: the longest label the service accepts. */
export const MAX_KEY_LABEL_LENGTH = 64

/** Why signing in stopped before the service was asked. */
export enum SignInStop {
  /** The wallet cannot sign a plain message. */
  NoSignMessage = 'no-sign-message',
  /** The wallet refused or failed to sign. */
  WalletFailed = 'wallet-failed',
}

/** Where a sent payment stands while the page waits for the service to credit it. */
export enum PaymentConfirmation {
  Idle = 'idle',
  Waiting = 'waiting',
  Credited = 'credited',
  /** The page stopped waiting; the person can check again. */
  NotYet = 'not-yet',
}
