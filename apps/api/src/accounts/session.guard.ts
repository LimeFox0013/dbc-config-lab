import { Injectable, UnauthorizedException } from '@nestjs/common'
import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { AuthService } from './auth.service'
import { ACCOUNT_TEXT, SESSION_COOKIE } from './constants'
import type { AccountRequest } from './types'
import { readCookie } from './utils'

/** `wallet-sign-in`: lets a request through only with a live session, and attaches its account. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AccountRequest>()
    const token = readCookie(req.headers.cookie, SESSION_COOKIE)
    const account = token ? await this.auth.accountForSession(token) : undefined
    if (!account) throw new UnauthorizedException(ACCOUNT_TEXT.notSignedIn)
    req.account = account
    return true
  }
}
