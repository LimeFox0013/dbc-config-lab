import type { z } from 'zod'
import type { SolanaNetwork } from '../../core/shared'
import type { SignInStop, WatchKind } from './constants'
import type {
  AccountViewSchema,
  ApiKeyViewSchema,
  ChallengeSchema,
  CreatedKeySchema,
  DeliveryViewSchema,
  EndpointViewSchema,
  PaymentRequestSchema,
  RegisteredWebhookSchema,
  WatchEventViewSchema,
  WatchViewSchema,
} from './schemas'

export type Challenge = z.infer<typeof ChallengeSchema>
export type AccountView = z.infer<typeof AccountViewSchema>
export type ApiKeyView = z.infer<typeof ApiKeyViewSchema>
/** `api-keys`: the full key, in this answer only. */
export type CreatedKey = z.infer<typeof CreatedKeySchema>
export type PaymentRequestView = z.infer<typeof PaymentRequestSchema>
export type WatchView = z.infer<typeof WatchViewSchema>
export type WatchEventView = z.infer<typeof WatchEventViewSchema>
export type EndpointView = z.infer<typeof EndpointViewSchema>
/** `webhooks`: the signing secret, in this answer only. */
export type RegisteredWebhook = z.infer<typeof RegisteredWebhookSchema>
export type DeliveryView = z.infer<typeof DeliveryViewSchema>

/** A watch to add, as the service takes it. */
export interface NewWatch {
  kind: WatchKind
  target: WatchView['target']
  network: SolanaNetwork
  thresholdSol?: number
}

/**
 * A request the service refused or that never reached it. `message` is the service's own
 * words, shown verbatim; null when it gave none (unreachable, or an unreadable answer).
 */
export interface ApiFailure {
  status: number
  message: string | null
}

export type ApiResult<T> =
  { ok: true; value: T } | { ok: false; failure: ApiFailure }

/** Signing in: the account, the service's refusal, or why the wallet step stopped. */
export type SignInResult =
  | ApiResult<AccountView>
  | { ok: false; stop: SignInStop; detail: string | null }

/** Anything that fetches like `fetch`; replaceable in tests. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>
