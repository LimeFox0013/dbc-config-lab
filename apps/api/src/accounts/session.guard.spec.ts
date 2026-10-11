import { UnauthorizedException } from '@nestjs/common'
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { mockDb } from '../testing/mock-db'
import { CALLER_HASH_KEY_ENV, UsageService } from '../usage'
import { AccountsService } from './accounts.service'
import { AuthService } from './auth.service'
import { SESSION_COOKIE } from './constants'
import { SessionGuard } from './session.guard'
import type { Account } from './types'

const account: Account = {
  id: 'account-1',
  walletAddress: 'wallet-1',
  paidPlan: null,
  planEndsAt: null,
  createdAt: new Date(),
}

/** Knows one live session token; the database is never reached. */
class OneSessionAuth extends AuthService {
  override async accountForSession(
    token: string,
  ): Promise<Account | undefined> {
    return token === 'live-token' ? account : undefined
  }
}

describe('SessionGuard (wallet-sign-in)', () => {
  let guard: SessionGuard

  beforeAll(() => {
    vi.stubEnv(CALLER_HASH_KEY_ENV, 'test-key')
    const db = mockDb()
    guard = new SessionGuard(
      new OneSessionAuth(db, new AccountsService(db, new UsageService(db))),
    )
  })
  afterAll(() => vi.unstubAllEnvs())

  const contextFor = (cookie?: string) => {
    const req: { headers: { cookie?: string }; account?: Account } = {
      headers: cookie === undefined ? {} : { cookie },
    }
    return { req, context: new ExecutionContextHost([req]) }
  }

  it('lets a live session through and attaches its account', async () => {
    const { req, context } = contextFor(`a=1; ${SESSION_COOKIE}=live-token`)
    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(req.account).toBe(account)
  })

  it('refuses a request without the session cookie', async () => {
    const { context } = contextFor()
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    )
  })

  it('refuses an ended or unknown session', async () => {
    const { req, context } = contextFor(`${SESSION_COOKIE}=stale-token`)
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    )
    expect(req.account).toBeUndefined()
  })
})
