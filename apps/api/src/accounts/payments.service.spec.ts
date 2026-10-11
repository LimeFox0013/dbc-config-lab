import { NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockDb } from '../testing/mock-db'
import { ACCOUNT_TEXT, AccountEnv, PlanId } from './constants'
import { PaymentsService } from './payments.service'
import type { Account } from './types'

const account: Account = {
  id: 'account-1',
  walletAddress: 'wallet-1',
  paidPlan: null,
  planEndsAt: null,
  createdAt: new Date(),
}

/** The refusals happen before anything is stored, so no database is needed. */
describe('PaymentsService.request (usdc-plan-payment)', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('refuses while the deployment has no receiving wallet', async () => {
    vi.stubEnv(AccountEnv.PayRecipient, '')
    const request = new PaymentsService(mockDb()).request(account, PlanId.Pro)
    await expect(request).rejects.toThrow(ServiceUnavailableException)
    await expect(request).rejects.toThrow(ACCOUNT_TEXT.paymentsOff)
  })

  it('refuses a plan that has no price', async () => {
    vi.stubEnv(AccountEnv.PayRecipient, 'recipient')
    const request = new PaymentsService(mockDb()).request(account, PlanId.Free)
    await expect(request).rejects.toThrow(NotFoundException)
    await expect(request).rejects.toThrow(ACCOUNT_TEXT.unknownPlan)
  })
})
