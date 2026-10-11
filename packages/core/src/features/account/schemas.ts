import { z } from 'zod'
import { SolanaNetwork } from '../../core/shared'
import { DeliveryStatus, PlanId, WatchKind } from './constants'

/** What the service answers, checked before the page uses it. */
export const ChallengeSchema = z.object({
  message: z.string(),
  nonce: z.string(),
})

export const AccountViewSchema = z.object({
  walletAddress: z.string(),
  plan: z.nativeEnum(PlanId),
  planEndsAt: z.string().nullable(),
  callsToday: z.number(),
  dailyCalls: z.number(),
  watches: z.number(),
})

export const ApiKeyViewSchema = z.object({
  id: z.string(),
  label: z.string(),
  prefix: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
})

export const CreatedKeySchema = z.object({
  key: z.string(),
  view: ApiKeyViewSchema,
})

export const PaymentRequestSchema = z.object({
  reference: z.string(),
  plan: z.nativeEnum(PlanId),
  amountUsdc: z.number(),
  recipient: z.string(),
  network: z.nativeEnum(SolanaNetwork),
  url: z.string(),
  credited: z.boolean(),
  planEndsAt: z.string().nullable(),
})

export const WatchViewSchema = z.object({
  id: z.string(),
  kind: z.nativeEnum(WatchKind),
  target: z.string(),
  network: z.nativeEnum(SolanaNetwork),
  thresholdSol: z.number().nullable(),
  paused: z.boolean(),
  lastCheckedAt: z.string().nullable(),
  createdAt: z.string(),
})

export const WatchEventViewSchema = z.object({
  id: z.string(),
  watchId: z.string(),
  type: z.string(),
  before: z.unknown(),
  after: z.unknown(),
  seenAt: z.string(),
})

export const EndpointViewSchema = z.object({
  id: z.string(),
  url: z.string(),
  createdAt: z.string(),
})

export const RegisteredWebhookSchema = z.object({
  secret: z.string(),
  endpoint: EndpointViewSchema,
})

export const DeliveryViewSchema = z.object({
  id: z.string(),
  endpointId: z.string(),
  eventId: z.string().nullable(),
  type: z.string(),
  status: z.nativeEnum(DeliveryStatus),
  attempts: z.number(),
  lastStatusCode: z.number().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
  deliveredAt: z.string().nullable(),
})

/** A `204 No Content` answer. */
export const NoContentSchema = z.null()
