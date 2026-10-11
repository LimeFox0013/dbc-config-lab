import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import type { z } from 'zod'
import { ACCOUNT_TEXT } from './constants'
import type { Account, AccountRequest } from './types'

/** A request body checked against its schema; anything else is a readable 400. */
export const parseBody = <T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
): z.infer<T> => {
  const result = schema.safeParse(body)
  if (!result.success) throw new BadRequestException(ACCOUNT_TEXT.badRequest)
  return result.data
}

/** The account `SessionGuard` attached. */
export const accountOf = (req: Pick<AccountRequest, 'account'>): Account => {
  if (!req.account) throw new UnauthorizedException(ACCOUNT_TEXT.notSignedIn)
  return req.account
}
