import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { ACCOUNT_TEXT } from './constants'
import { accountOf, parseBody } from './request'
import { CreateKeyBody } from './schemas'
import type { Account } from './types'

const account: Account = {
  id: 'account-1',
  walletAddress: 'wallet-1',
  paidPlan: null,
  planEndsAt: null,
  createdAt: new Date(),
}

describe('parseBody', () => {
  it('returns the body as its schema reads it', () => {
    expect(parseBody(CreateKeyBody, { label: '  my agent  ' })).toEqual({
      label: 'my agent',
    })
  })

  it('refuses anything else with a readable 400 that does not echo the input', () => {
    const refusal = (): unknown => parseBody(CreateKeyBody, { label: '' })
    expect(refusal).toThrow(BadRequestException)
    expect(refusal).toThrow(ACCOUNT_TEXT.badRequest)
  })
})

describe('accountOf', () => {
  it('returns the account the session guard attached', () => {
    expect(accountOf({ account })).toBe(account)
  })

  it('refuses a request no guard has attached an account to', () => {
    expect(() => accountOf({})).toThrow(UnauthorizedException)
  })
})
