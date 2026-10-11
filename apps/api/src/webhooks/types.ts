import type { InferSelectModel } from 'drizzle-orm'
import type {
  webhookAttempts,
  webhookDeliveries,
  webhookEndpoints,
} from '../db'
import type { DeliveryStatus } from './constants'

export type EndpointRow = InferSelectModel<typeof webhookEndpoints>
export type DeliveryRow = InferSelectModel<typeof webhookDeliveries>
export type AttemptRow = InferSelectModel<typeof webhookAttempts>

export interface EndpointView {
  id: string
  url: string
  createdAt: string
}

/** A newly registered address: its signing secret, returned this once only, and its view. */
export interface RegisteredEndpoint {
  secret: string
  endpoint: EndpointView
}

export interface AttemptView {
  attempt: number
  statusCode: number | null
  error: string | null
  attemptedAt: string
}

export interface DeliveryView {
  id: string
  endpointId: string
  eventId: string | null
  type: string
  status: string
  attempts: number
  lastStatusCode: number | null
  lastError: string | null
  createdAt: string
  deliveredAt: string | null
  /** Every attempt so far, first first. */
  attemptLog: AttemptView[]
}

/** A delivery's JSON body: the event, as the receiver gets it. */
export interface DeliveryPayload {
  type: string
  [field: string]: unknown
}

/** What one attempt at sending got back: an HTTP status, or an error and no status. */
export interface SendOutcome {
  status: number | null
  error: string | null
}

/** Where a delivery stands after an attempt. */
export interface DeliveryProgress {
  status: DeliveryStatus
  nextAttemptAt: Date | null
  deliveredAt: Date | null
}
