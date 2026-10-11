import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  DeliveryStatus,
  MAX_DELIVERY_ATTEMPTS,
  TEST_EVENT_TYPE,
  WEBHOOK_TEXT,
} from './constants'
import type { AttemptRow, DeliveryRow } from './types'
import {
  decryptSecret,
  deliveryProgress,
  deliveryType,
  encryptSecret,
  isHttpsUrl,
  isSuccessStatus,
  nextAttemptAt,
  secretKey,
  signDelivery,
  toDeliveryView,
  toEndpointView,
  unixTimestamp,
} from './utils'

describe('webhook secrets and signatures', () => {
  const key = secretKey('root-secret')

  it('stores a secret encrypted and reads it back only with the same key', () => {
    const stored = encryptSecret('whsec_abc', key)
    expect(stored).not.toContain('whsec_abc')
    expect(decryptSecret(stored, key)).toBe('whsec_abc')
    expect(() => decryptSecret(stored, secretKey('another-root'))).toThrow()
  })

  it('signs timestamp and body so a receiver can recompute it', () => {
    const expected = createHmac('sha256', 'whsec_abc')
      .update('1700000000.{"a":1}')
      .digest('hex')
    expect(signDelivery('whsec_abc', '1700000000', '{"a":1}')).toBe(
      `sha256=${expected}`,
    )
    expect(signDelivery('whsec_abc', '1700000001', '{"a":1}')).not.toBe(
      `sha256=${expected}`,
    )
  })

  it('waits 30 s before the second attempt, doubling after each failure', () => {
    const now = new Date(0)
    expect(nextAttemptAt(1, now).getTime()).toBe(30_000)
    expect(nextAttemptAt(2, now).getTime()).toBe(60_000)
    expect(nextAttemptAt(4, now).getTime()).toBe(240_000)
  })

  it('accepts https addresses only', () => {
    expect(isHttpsUrl('https://hooks.example/x')).toBe(true)
    expect(isHttpsUrl('http://hooks.example/x')).toBe(false)
    expect(isHttpsUrl('not a url')).toBe(false)
  })

  it('refuses a stored secret that is not iv.tag.ciphertext', () => {
    expect(() => decryptSecret('only-one-part', key)).toThrow(
      WEBHOOK_TEXT.malformedSecret,
    )
  })

  it('stamps a delivery with whole seconds since the epoch', () => {
    expect(unixTimestamp(new Date(1_700_000_000_999))).toBe('1700000000')
  })
})

describe('delivery progress', () => {
  const now = new Date(0)

  it('counts any 2xx answer as accepted, and nothing else', () => {
    expect(isSuccessStatus(200)).toBe(true)
    expect(isSuccessStatus(299)).toBe(true)
    expect(isSuccessStatus(300)).toBe(false)
    expect(isSuccessStatus(199)).toBe(false)
    expect(isSuccessStatus(null)).toBe(false)
  })

  it('is delivered on a 2xx, whatever the attempt', () => {
    expect(deliveryProgress(MAX_DELIVERY_ATTEMPTS, 204, now)).toEqual({
      status: DeliveryStatus.Delivered,
      nextAttemptAt: null,
      deliveredAt: now,
    })
  })

  it('is due again after a growing pause until the attempts run out, then failed', () => {
    expect(deliveryProgress(1, 500, now)).toEqual({
      status: DeliveryStatus.Pending,
      nextAttemptAt: nextAttemptAt(1, now),
      deliveredAt: null,
    })
    expect(deliveryProgress(MAX_DELIVERY_ATTEMPTS - 1, null, now).status).toBe(
      DeliveryStatus.Pending,
    )
    expect(deliveryProgress(MAX_DELIVERY_ATTEMPTS, 500, now)).toEqual({
      status: DeliveryStatus.Failed,
      nextAttemptAt: null,
      deliveredAt: null,
    })
  })
})

describe('delivery views', () => {
  const at = new Date('2026-10-05T10:00:00Z')
  const delivery: DeliveryRow = {
    id: 'delivery-1',
    endpointId: 'endpoint-1',
    eventId: null,
    payload: { type: 'new-pool' },
    status: DeliveryStatus.Pending,
    attempts: 2,
    lastStatusCode: 500,
    lastError: 'HTTP 500',
    nextAttemptAt: at,
    createdAt: at,
    deliveredAt: null,
  }
  const attempt = (n: number, deliveryId = delivery.id): AttemptRow => ({
    id: `attempt-${deliveryId}-${n}`,
    deliveryId,
    attempt: n,
    statusCode: 500,
    error: 'HTTP 500',
    attemptedAt: at,
  })

  it('names the event type a payload carries, or test when it carries none', () => {
    expect(deliveryType({ type: 'graduation' })).toBe('graduation')
    expect(deliveryType({ type: 7 })).toBe(TEST_EVENT_TYPE)
    expect(deliveryType(null)).toBe(TEST_EVENT_TYPE)
  })

  it('shows an endpoint without its stored secret', () => {
    expect(
      toEndpointView({
        id: 'endpoint-1',
        accountId: 'account-1',
        url: 'https://hooks.example/x',
        secretCiphertext: 'iv.tag.ciphertext',
        createdAt: at,
      }),
    ).toEqual({
      id: 'endpoint-1',
      url: 'https://hooks.example/x',
      createdAt: '2026-10-05T10:00:00.000Z',
    })
  })

  it('shows a delivery with only its own attempts, in the order given', () => {
    const view = toDeliveryView(delivery, [
      attempt(1),
      attempt(1, 'delivery-2'),
      attempt(2),
    ])
    expect(view).toMatchObject({
      id: 'delivery-1',
      type: 'new-pool',
      status: DeliveryStatus.Pending,
      attempts: 2,
      lastStatusCode: 500,
      createdAt: '2026-10-05T10:00:00.000Z',
      deliveredAt: null,
    })
    const logged = (n: number) => ({
      attempt: n,
      statusCode: 500,
      error: 'HTTP 500',
      attemptedAt: '2026-10-05T10:00:00.000Z',
    })
    expect(view.attemptLog).toEqual([logged(1), logged(2)])
  })
})
