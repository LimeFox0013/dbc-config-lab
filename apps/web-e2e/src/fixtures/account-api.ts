import type { Page, Route } from '@playwright/test'
import {
  ACCOUNT_API,
  FAKE_WALLET_ADDRESS,
  PAYMENT_RECIPIENT,
  PAYMENT_REFERENCE,
} from './constants'

/** Rows the mock keeps, in the service's own answer shapes. */
export interface MockKey {
  id: string
  label: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

export interface MockWatch {
  id: string
  kind: 'config' | 'fee-wallet'
  target: string
  network: string
  thresholdSol: number | null
  paused: boolean
  lastCheckedAt: string | null
  createdAt: string
}

export interface MockEndpoint {
  id: string
  url: string
  createdAt: string
}

export interface MockDelivery {
  id: string
  endpointId: string
  eventId: string | null
  type: string
  status: 'pending' | 'delivered' | 'failed'
  attempts: number
  lastStatusCode: number | null
  lastError: string | null
  createdAt: string
  deliveredAt: string | null
}

/** The hosted service as the page sees it; tests read and seed it directly. */
export interface AccountApiState {
  signedIn: boolean
  plan: 'free' | 'pro'
  planEndsAt: string | null
  callsToday: number
  dailyCalls: number
  watchLimit: number
  keys: MockKey[]
  watches: MockWatch[]
  webhooks: MockEndpoint[]
  deliveries: MockDelivery[]
  /** Payment checks answered "not credited" before one is credited. */
  checksBeforeCredit: number
  paymentChecks: number
  /** Every request the page sent, for assertions. */
  requests: { method: string; path: string; body: unknown }[]
}

export const NOW = '2026-10-05T09:30:00.000Z'
export const PAID_UNTIL = '2026-11-04T09:30:00.000Z'
export const NEW_KEY = 'lab_k7Qm2xVn9RtB4yLp8cWs3dHf6gJa'
export const NEW_KEY_PREFIX = 'lab_k7Qm'
export const NEW_WEBHOOK_SECRET = 'whsec_Zp4Nq8Lr2Ty6Vb1Xc5Mk9Hj3Gd7Fs0Wa' // gitleaks:allow — test fixture
export const SIGN_IN_REFUSAL = 'Sign in with your wallet first.'
export const watchLimitText = (limit: number): string =>
  `This account's plan allows ${limit} watches; delete or pause one first, or move to a paid plan.`

export const signInMessage = (address: string): string =>
  [
    'localhost:5181 wants you to sign in with your Solana account:',
    address,
    '',
    'Sign in to DBC Config Lab.',
    '',
    'Version: 1',
    'Nonce: e2eNonce',
    `Issued At: ${NOW}`,
    'Expiration Time: 2026-10-05T09:35:00.000Z',
  ].join('\n')

export const initialAccountState = (
  overrides: Partial<AccountApiState> = {},
): AccountApiState => ({
  signedIn: false,
  plan: 'free',
  planEndsAt: null,
  callsToday: 12,
  dailyCalls: 200,
  watchLimit: 3,
  keys: [],
  watches: [],
  webhooks: [],
  deliveries: [],
  checksBeforeCredit: 1,
  paymentChecks: 0,
  requests: [],
  ...overrides,
})

export const sampleWatch = (id: string): MockWatch => ({
  id,
  kind: 'config',
  target: FAKE_WALLET_ADDRESS,
  network: 'mainnet-beta',
  thresholdSol: null,
  paused: false,
  lastCheckedAt: NOW,
  createdAt: NOW,
})

const accountView = (state: AccountApiState) => ({
  walletAddress: FAKE_WALLET_ADDRESS,
  plan: state.plan,
  planEndsAt: state.planEndsAt,
  callsToday: state.callsToday,
  dailyCalls: state.dailyCalls,
  watches: state.watches.length,
})

const paymentView = (state: AccountApiState, credited: boolean) => ({
  reference: PAYMENT_REFERENCE,
  plan: 'pro',
  amountUsdc: 49,
  recipient: PAYMENT_RECIPIENT,
  network: 'devnet',
  url: `solana:${PAYMENT_RECIPIENT}?amount=49`,
  credited,
  planEndsAt: state.planEndsAt,
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const field = (body: unknown, name: string): unknown =>
  isRecord(body) ? body[name] : undefined

/**
 * Serves the account API from `state`, with the CORS headers a credentialed
 * cross-origin call needs. Anything the mock does not know fails loudly.
 */
export const mockAccountApi = async (
  page: Page,
  state: AccountApiState,
): Promise<void> => {
  await page.route(`${ACCOUNT_API}/**`, async (route: Route) => {
    const request = route.request()
    const origin = (await request.headerValue('origin')) ?? '*'
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
    const method = request.method()
    if (method === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors })
    const path = new URL(request.url()).pathname
    const body: unknown = request.postData() ? request.postDataJSON() : null
    state.requests.push({ method, path, body })

    const reply = (status: number, payload?: unknown) =>
      route.fulfill({
        status,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: payload === undefined ? '' : JSON.stringify(payload),
      })
    const refuse = (status: number, message: string) =>
      reply(status, { statusCode: status, message })
    const segments = path.split('/').filter(Boolean)
    const [root, section, id, action] = segments

    if (path === '/auth/challenge' && method === 'POST')
      return reply(201, {
        message: signInMessage(String(field(body, 'address'))),
        nonce: 'e2eNonce',
      })
    if (path === '/auth/session' && method === 'POST') {
      state.signedIn = true
      return reply(201, accountView(state))
    }
    if (path === '/auth/session' && method === 'DELETE') {
      state.signedIn = false
      return reply(204)
    }
    if (root !== 'account') return refuse(404, `unexpected ${method} ${path}`)
    if (!state.signedIn) return refuse(401, SIGN_IN_REFUSAL)

    if (section === undefined && method === 'GET')
      return reply(200, accountView(state))

    if (section === 'keys') {
      if (method === 'GET') return reply(200, state.keys)
      if (method === 'POST') {
        const view: MockKey = {
          id: `key-${state.keys.length + 1}`,
          label: String(field(body, 'label')),
          prefix: NEW_KEY_PREFIX,
          createdAt: NOW,
          lastUsedAt: null,
        }
        state.keys = [...state.keys, view]
        return reply(201, { key: NEW_KEY, view })
      }
      if (method === 'DELETE' && id) {
        state.keys = state.keys.filter((key) => key.id !== id)
        return reply(204)
      }
    }

    if (section === 'payments') {
      if (method === 'POST') return reply(201, paymentView(state, false))
      if (method === 'GET' && id === PAYMENT_REFERENCE) {
        state.paymentChecks += 1
        const credited = state.paymentChecks > state.checksBeforeCredit
        if (credited) {
          state.plan = 'pro'
          state.planEndsAt = PAID_UNTIL
          state.dailyCalls = 20_000
        }
        return reply(200, paymentView(state, credited))
      }
    }

    if (section === 'watches') {
      if (method === 'GET') return reply(200, state.watches)
      if (method === 'POST') {
        if (state.watches.length >= state.watchLimit)
          return refuse(400, watchLimitText(state.watchLimit))
        const watch: MockWatch = {
          ...sampleWatch(`watch-${state.watches.length + 1}`),
          target: String(field(body, 'target')),
          lastCheckedAt: null,
        }
        state.watches = [...state.watches, watch]
        return reply(201, watch)
      }
      const existing = state.watches.find((watch) => watch.id === id)
      if (method === 'PATCH' && existing) {
        const changed: MockWatch = {
          ...existing,
          paused: field(body, 'paused') === true,
        }
        state.watches = state.watches.map((watch) =>
          watch.id === id ? changed : watch,
        )
        return reply(200, changed)
      }
      if (method === 'DELETE' && existing) {
        state.watches = state.watches.filter((watch) => watch.id !== id)
        return reply(204)
      }
    }

    if (section === 'events' && method === 'GET') return reply(200, [])

    if (section === 'webhooks') {
      if (method === 'GET') return reply(200, state.webhooks)
      if (method === 'POST' && id === undefined) {
        const endpoint: MockEndpoint = {
          id: `hook-${state.webhooks.length + 1}`,
          url: String(field(body, 'url')),
          createdAt: NOW,
        }
        state.webhooks = [...state.webhooks, endpoint]
        return reply(201, { secret: NEW_WEBHOOK_SECRET, endpoint })
      }
      if (method === 'POST' && id && action === 'test') {
        const delivery: MockDelivery = {
          id: `delivery-${state.deliveries.length + 1}`,
          endpointId: id,
          eventId: null,
          type: 'test',
          status: 'delivered',
          attempts: 1,
          lastStatusCode: 200,
          lastError: null,
          createdAt: NOW,
          deliveredAt: NOW,
        }
        state.deliveries = [delivery, ...state.deliveries]
        return reply(201, delivery)
      }
      if (method === 'DELETE' && id) {
        state.webhooks = state.webhooks.filter((hook) => hook.id !== id)
        return reply(204)
      }
    }

    if (section === 'deliveries' && method === 'GET')
      return reply(200, state.deliveries)

    return refuse(500, `unexpected ${method} ${path}`)
  })
}
