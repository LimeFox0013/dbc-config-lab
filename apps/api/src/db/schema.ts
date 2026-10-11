import { randomUUID } from 'node:crypto'
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

/**
 * `hosted-agent-tools`: tool calls per caller per UTC day. A caller is an API
 * key id or a hash of a network address — never the address itself.
 */
export const dailyUsage = pgTable(
  'daily_usage',
  {
    caller: text('caller').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    calls: integer('calls').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.caller, table.day] })],
)

/** `wallet-sign-in`: one account per wallet address, created on first sign-in. */
export const accounts = pgTable('accounts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  walletAddress: text('wallet_address').notNull().unique(),
  /** `service-plans`: the paid plan, when one is active until `planEndsAt`. */
  paidPlan: text('paid_plan'),
  planEndsAt: timestamp('plan_ends_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/** `wallet-sign-in`: one-time sign-in challenges; a used or expired one is refused. */
export const signInChallenges = pgTable('sign_in_challenges', {
  nonce: text('nonce').primaryKey(),
  walletAddress: text('wallet_address').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

/** `wallet-sign-in`: signed-in sessions, stored as a hash of the cookie's token. */
export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

/** `api-keys`: `@lf/agentic-account` roles (one, `mcp-caller`). */
export const agenticRoles = pgTable('agentic_roles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text('name').notNull().unique(),
  permissions: text('permissions').array().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/** `api-keys`: an account's keys — the hash only, never the key. `tenantId` is the account. */
export const agenticAccounts = pgTable('agentic_accounts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  roleId: text('role_id')
    .notNull()
    .references(() => agenticRoles.id),
  externalSystem: text('external_system').notNull(),
  externalRef: text('external_ref').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
})

/**
 * `usdc-plan-payment`: Solana Pay requests. `reference` is the request's
 * unique key; `signature` is unique, so one transfer credits a plan once.
 */
export const payments = pgTable('payments', {
  reference: text('reference').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  plan: text('plan').notNull(),
  /** USDC base units (6 decimals). */
  amount: bigint('amount', { mode: 'bigint' }).notNull(),
  recipient: text('recipient').notNull(),
  network: text('network').notNull(),
  signature: text('signature').unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  creditedAt: timestamp('credited_at', { withTimezone: true }),
})

/** `watches`: what an account keeps an eye on, and the state last seen. */
export const watches = pgTable('watches', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  /** `config` or `fee-wallet`. */
  kind: text('kind').notNull(),
  target: text('target').notNull(),
  network: text('network').notNull(),
  /** Fee wallets: the unclaimed value, in SOL, above which an event is raised. */
  thresholdSol: doublePrecision('threshold_sol'),
  paused: boolean('paused').notNull().default(false),
  lastState: jsonb('last_state'),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/** `watches`: each change, recorded once. */
export const watchEvents = pgTable('watch_events', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  watchId: text('watch_id')
    .notNull()
    .references(() => watches.id, { onDelete: 'cascade' }),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  seenAt: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * `webhooks`: an account's delivery addresses. The signing secret is stored
 * encrypted (AES-256-GCM, key derived from `CALLER_HASH_KEY`); it is shown to
 * the account once, at registration.
 */
export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  secretCiphertext: text('secret_ciphertext').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/** `webhooks`: one delivery of one event to one address, with its current outcome. */
export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  endpointId: text('endpoint_id')
    .notNull()
    .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
  /** Null for a test delivery. */
  eventId: text('event_id').references(() => watchEvents.id, {
    onDelete: 'cascade',
  }),
  payload: jsonb('payload').notNull(),
  /** `pending`, `delivered` or `failed`. */
  status: text('status').notNull(),
  attempts: integer('attempts').notNull().default(0),
  lastStatusCode: integer('last_status_code'),
  lastError: text('last_error'),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
})

/** `webhooks`: every attempt at a delivery, kept for the account to read. */
export const webhookAttempts = pgTable(
  'webhook_attempts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    deliveryId: text('delivery_id')
      .notNull()
      .references(() => webhookDeliveries.id, { onDelete: 'cascade' }),
    /** 1 for the first attempt. */
    attempt: integer('attempt').notNull(),
    statusCode: integer('status_code'),
    error: text('error'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('webhook_attempts_delivery_idx').on(table.deliveryId)],
)
