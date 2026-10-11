import type { z } from 'zod'
import {
  AccountRoute,
  HttpMethod,
  NETWORK_FAILURE_STATUS,
  PlanId,
  WEBHOOK_TEST_SUFFIX,
} from './constants'
import {
  AccountViewSchema,
  ApiKeyViewSchema,
  ChallengeSchema,
  CreatedKeySchema,
  DeliveryViewSchema,
  EndpointViewSchema,
  NoContentSchema,
  PaymentRequestSchema,
  RegisteredWebhookSchema,
  WatchEventViewSchema,
  WatchViewSchema,
} from './schemas'
import type {
  AccountView,
  ApiKeyView,
  ApiResult,
  Challenge,
  CreatedKey,
  DeliveryView,
  EndpointView,
  FetchLike,
  NewWatch,
  PaymentRequestView,
  RegisteredWebhook,
  WatchEventView,
  WatchView,
} from './types'
import { errorMessageOf } from './utils'

/** The answer's JSON, or null when it has none (`204`) or is not JSON. */
const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text()
  if (!text) return null
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed
  } catch {
    return null
  }
}

const withId = (route: AccountRoute, id: string): string =>
  `${route}/${encodeURIComponent(id)}`

/**
 * The hosted service's account API. Every call carries the session cookie
 * (`credentials: 'include'`), and resolves — never throws — to the checked answer or to
 * the service's refusal in its own words.
 */
export const createAccountClient = (
  baseUrl: string,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
) => {
  const call = async <S extends z.ZodTypeAny>(
    method: HttpMethod,
    path: string,
    schema: S,
    body?: unknown,
  ): Promise<ApiResult<z.output<S>>> => {
    const init: RequestInit = {
      method,
      credentials: 'include',
      ...(body === undefined
        ? {}
        : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
    }
    let response: Response
    try {
      response = await fetchImpl(`${baseUrl}${path}`, init)
    } catch {
      return {
        ok: false,
        failure: { status: NETWORK_FAILURE_STATUS, message: null },
      }
    }
    const payload = await readJson(response)
    if (!response.ok)
      return {
        ok: false,
        failure: { status: response.status, message: errorMessageOf(payload) },
      }
    const parsed = schema.safeParse(payload)
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, failure: { status: response.status, message: null } }
  }

  return {
    challenge: (address: string): Promise<ApiResult<Challenge>> =>
      call(HttpMethod.Post, AccountRoute.Challenge, ChallengeSchema, {
        address,
      }),
    signIn: (
      message: string,
      signature: string,
    ): Promise<ApiResult<AccountView>> =>
      call(HttpMethod.Post, AccountRoute.Session, AccountViewSchema, {
        message,
        signature,
      }),
    signOut: (): Promise<ApiResult<null>> =>
      call(HttpMethod.Delete, AccountRoute.Session, NoContentSchema),
    account: (): Promise<ApiResult<AccountView>> =>
      call(HttpMethod.Get, AccountRoute.Account, AccountViewSchema),

    keys: (): Promise<ApiResult<ApiKeyView[]>> =>
      call(HttpMethod.Get, AccountRoute.Keys, ApiKeyViewSchema.array()),
    createKey: (label: ApiKeyView['label']): Promise<ApiResult<CreatedKey>> =>
      call(HttpMethod.Post, AccountRoute.Keys, CreatedKeySchema, { label }),
    revokeKey: (id: ApiKeyView['id']): Promise<ApiResult<null>> =>
      call(HttpMethod.Delete, withId(AccountRoute.Keys, id), NoContentSchema),

    requestPayment: (
      plan: PlanId = PlanId.Pro,
    ): Promise<ApiResult<PaymentRequestView>> =>
      call(HttpMethod.Post, AccountRoute.Payments, PaymentRequestSchema, {
        plan,
      }),
    checkPayment: (
      reference: PaymentRequestView['reference'],
    ): Promise<ApiResult<PaymentRequestView>> =>
      call(
        HttpMethod.Get,
        withId(AccountRoute.Payments, reference),
        PaymentRequestSchema,
      ),

    watches: (): Promise<ApiResult<WatchView[]>> =>
      call(HttpMethod.Get, AccountRoute.Watches, WatchViewSchema.array()),
    addWatch: (watch: NewWatch): Promise<ApiResult<WatchView>> =>
      call(HttpMethod.Post, AccountRoute.Watches, WatchViewSchema, watch),
    setWatchPaused: (
      id: WatchView['id'],
      paused: WatchView['paused'],
    ): Promise<ApiResult<WatchView>> =>
      call(
        HttpMethod.Patch,
        withId(AccountRoute.Watches, id),
        WatchViewSchema,
        { paused },
      ),
    deleteWatch: (id: WatchView['id']): Promise<ApiResult<null>> =>
      call(
        HttpMethod.Delete,
        withId(AccountRoute.Watches, id),
        NoContentSchema,
      ),
    events: (): Promise<ApiResult<WatchEventView[]>> =>
      call(HttpMethod.Get, AccountRoute.Events, WatchEventViewSchema.array()),

    webhooks: (): Promise<ApiResult<EndpointView[]>> =>
      call(HttpMethod.Get, AccountRoute.Webhooks, EndpointViewSchema.array()),
    addWebhook: (
      url: EndpointView['url'],
    ): Promise<ApiResult<RegisteredWebhook>> =>
      call(HttpMethod.Post, AccountRoute.Webhooks, RegisteredWebhookSchema, {
        url,
      }),
    deleteWebhook: (id: EndpointView['id']): Promise<ApiResult<null>> =>
      call(
        HttpMethod.Delete,
        withId(AccountRoute.Webhooks, id),
        NoContentSchema,
      ),
    testWebhook: (id: EndpointView['id']): Promise<ApiResult<DeliveryView>> =>
      call(
        HttpMethod.Post,
        `${withId(AccountRoute.Webhooks, id)}${WEBHOOK_TEST_SUFFIX}`,
        DeliveryViewSchema,
      ),
    deliveries: (): Promise<ApiResult<DeliveryView[]>> =>
      call(HttpMethod.Get, AccountRoute.Deliveries, DeliveryViewSchema.array()),
  }
}

export type AccountClient = ReturnType<typeof createAccountClient>
