/** `webhooks`: delivery attempts per event at most. */
export const MAX_DELIVERY_ATTEMPTS = 6

/** The pause before the second attempt; it doubles after each failure. */
export const FIRST_RETRY_DELAY_MS = 30 * 1000

/** Deliveries sent per poller run at most, oldest due first. */
export const DELIVERIES_PER_RUN = 100

/** Webhook endpoints per account at most. */
export const MAX_ENDPOINTS_PER_ACCOUNT = 5

/** The longest webhook address accepted. */
export const MAX_WEBHOOK_URL_LENGTH = 2048

export const WEBHOOK_SECRET_BYTES = 32
export const WEBHOOK_SECRET_PREFIX = 'whsec_'

/** HKDF info that separates the webhook-secret key from the caller-hash use of the same root secret. */
export const SECRET_KEY_INFO = 'dbc-config-lab/webhook-secrets'

/** Stored secrets: AES-256-GCM with a 96-bit IV and a 256-bit key. */
export const SECRET_CIPHER = 'aes-256-gcm'
export const SECRET_IV_BYTES = 12
export const SECRET_KEY_BYTES = 32

/** The hash behind the secret key's derivation and every delivery signature. */
export const HASH_ALGORITHM = 'sha256'

/** The only address scheme a delivery goes to. */
export const HTTPS_PROTOCOL = 'https:'

/** A delivery is accepted by any 2xx answer: from the first status up to, not including, the limit. */
export const SUCCESS_STATUS_FIRST = 200
export const SUCCESS_STATUS_LIMIT = 300

export const MS_PER_SECOND = 1000

export const JSON_CONTENT_TYPE = 'application/json'

export enum DeliveryStatus {
  Pending = 'pending',
  Delivered = 'delivered',
  Failed = 'failed',
}

/** Headers a receiver checks: `signature` is `sha256=` + HMAC-SHA256 of `${timestamp}.${body}`. */
export enum WebhookHeader {
  ContentType = 'Content-Type',
  Event = 'X-Lab-Event',
  Timestamp = 'X-Lab-Timestamp',
  Signature = 'X-Lab-Signature',
}

export const TEST_EVENT_TYPE = 'test'

export const WEBHOOK_TEXT = {
  httpsOnly: 'A webhook address must be an https URL.',
  privateAddress:
    'A webhook address must be public — not a private, loopback or link-local one.',
  limitReached: `An account can register at most ${MAX_ENDPOINTS_PER_ACCOUNT} webhook addresses.`,
  notFound: 'No such webhook address on this account.',
  httpStatus: (status: number): string => `HTTP ${status}`,
  deliveryFailed: 'Delivery failed',
  malformedSecret: 'Malformed stored secret',
} as const
