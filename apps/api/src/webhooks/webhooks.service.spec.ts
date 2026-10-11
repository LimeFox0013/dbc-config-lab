import { BadRequestException } from '@nestjs/common'
import { safeFetch, sanitizeUrl, SsrfErrorCode } from '@lf/safe-fetch'
import type * as SafeFetch from '@lf/safe-fetch'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { mockDb } from '../testing/mock-db'
import { CALLER_HASH_KEY_ENV } from '../usage'
import { WEBHOOK_TEXT } from './constants'
import type { SendOutcome } from './types'
import { WebhooksService } from './webhooks.service'

vi.mock('@lf/safe-fetch', async (importOriginal) => ({
  ...(await importOriginal<typeof SafeFetch>()),
  safeFetch: vi.fn(),
  sanitizeUrl: vi.fn(),
}))

/** Exposes the one network step, so its outcomes can be read without a database. */
class Probe extends WebhooksService {
  sendNow(url: string): Promise<SendOutcome> {
    return this.send(url, {}, '{}')
  }
}

const blocked = { code: SsrfErrorCode.ERR_PRIVATE_IP, message: 'private' }

describe('WebhooksService (webhooks)', () => {
  let webhooks: Probe

  beforeAll(() => {
    vi.stubEnv(CALLER_HASH_KEY_ENV, 'test-key')
    webhooks = new Probe(mockDb())
  })
  afterAll(() => vi.unstubAllEnvs())
  beforeEach(() => vi.mocked(safeFetch).mockReset())

  it('refuses to start without the root secret its signing key comes from', () => {
    vi.stubEnv(CALLER_HASH_KEY_ENV, '')
    expect(() => new WebhooksService(mockDb())).toThrow(CALLER_HASH_KEY_ENV)
    vi.stubEnv(CALLER_HASH_KEY_ENV, 'test-key')
  })

  it('refuses to register a plain-http or private address', async () => {
    await expect(
      webhooks.register('account-1', 'http://hooks.example.com/x'),
    ).rejects.toThrow(new BadRequestException(WEBHOOK_TEXT.httpsOnly))
    vi.mocked(sanitizeUrl).mockResolvedValueOnce(blocked)
    await expect(
      webhooks.register('account-1', 'https://hooks.internal/x'),
    ).rejects.toThrow(new BadRequestException(WEBHOOK_TEXT.privateAddress))
  })

  it('reports the status a receiver answered with, and an error unless it was 2xx', async () => {
    vi.mocked(safeFetch).mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    )
    expect(await webhooks.sendNow('https://hooks.example.com/x')).toEqual({
      status: 204,
      error: null,
    })
    // A redirect is never followed: it could lead to an address the check never saw.
    expect(safeFetch).toHaveBeenCalledWith(
      'https://hooks.example.com/x',
      expect.objectContaining({ method: 'POST', redirect: 'manual' }),
    )
    vi.mocked(safeFetch).mockResolvedValueOnce(
      new Response(null, { status: 503 }),
    )
    expect(await webhooks.sendNow('https://hooks.example.com/x')).toEqual({
      status: 503,
      error: WEBHOOK_TEXT.httpStatus(503),
    })
  })

  it('never sends to a plain-http address, and reports one that resolves privately', async () => {
    expect(await webhooks.sendNow('http://hooks.example.com/x')).toEqual({
      status: null,
      error: WEBHOOK_TEXT.httpsOnly,
    })
    expect(safeFetch).not.toHaveBeenCalled()
    vi.mocked(safeFetch).mockResolvedValueOnce(blocked)
    expect(await webhooks.sendNow('https://hooks.example.com/x')).toEqual({
      status: null,
      error: WEBHOOK_TEXT.privateAddress,
    })
  })

  it('records a failed connection as an error with no status', async () => {
    vi.mocked(safeFetch).mockRejectedValueOnce(
      new Error('connect ECONNREFUSED'),
    )
    expect(await webhooks.sendNow('https://hooks.example.com/x')).toEqual({
      status: null,
      error: 'connect ECONNREFUSED',
    })
  })
})
