import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { AccountsService } from './accounts.service'
import { AuthService } from './auth.service'
import {
  ACCOUNT_TEXT,
  SECURE_PROTOCOL,
  SESSION_COOKIE,
  SESSION_COOKIE_PATH,
  SESSION_TTL_MS,
} from './constants'
import { KeysService } from './keys.service'
import { PaymentsService } from './payments.service'
import {
  ChallengeBody,
  CreateKeyBody,
  PaymentBody,
  SignInBody,
} from './schemas'
import { SessionGuard } from './session.guard'
import type {
  AccountRequest,
  AccountView,
  ApiKeyView,
  CreatedApiKey,
  PaymentRequestView,
  SignInChallenge,
} from './types'
import { accountOf, parseBody } from './request'
import { readCookie, signInDomain, siteOrigin } from './utils'

/** `wallet-sign-in`: challenge, sign in, sign out. */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly accounts: AccountsService,
  ) {}

  @Post('challenge')
  challenge(@Body() body: unknown): Promise<SignInChallenge> {
    const { address } = parseBody(ChallengeBody, body)
    return this.auth.challenge(address, signInDomain())
  }

  @Post('session')
  async signIn(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccountView> {
    const { message, signature } = parseBody(SignInBody, body)
    const session = await this.auth.signIn(message, signature, signInDomain())
    if (!session) throw new UnauthorizedException(ACCOUNT_TEXT.invalidSignIn)
    res.cookie(SESSION_COOKIE, session.token, {
      httpOnly: true,
      secure: siteOrigin().startsWith(SECURE_PROTOCOL),
      sameSite: 'lax',
      path: SESSION_COOKIE_PATH,
      maxAge: SESSION_TTL_MS,
    })
    return this.accounts.view(session.account)
  }

  @Delete('session')
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE)
    if (token) await this.auth.signOut(token)
    res.clearCookie(SESSION_COOKIE, { path: SESSION_COOKIE_PATH })
  }
}

/** The signed-in account: its plan and usage, its API keys, its payments. */
@Controller('account')
@UseGuards(SessionGuard)
export class AccountController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly keys: KeysService,
    private readonly payments: PaymentsService,
  ) {}

  @Get()
  view(@Req() req: AccountRequest): Promise<AccountView> {
    return this.accounts.view(accountOf(req))
  }

  @Get('keys')
  listKeys(@Req() req: AccountRequest): Promise<ApiKeyView[]> {
    return this.keys.list(accountOf(req).id)
  }

  /** `api-keys`: the full key is in this response only. */
  @Post('keys')
  createKey(
    @Req() req: AccountRequest,
    @Body() body: unknown,
  ): Promise<CreatedApiKey> {
    const { label } = parseBody(CreateKeyBody, body)
    return this.keys.create(accountOf(req).id, label)
  }

  @Delete('keys/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeKey(
    @Req() req: AccountRequest,
    @Param('id') id: string,
  ): Promise<void> {
    if (!(await this.keys.revoke(accountOf(req).id, id)))
      throw new NotFoundException(ACCOUNT_TEXT.keyNotFound)
  }

  @Post('payments')
  requestPayment(
    @Req() req: AccountRequest,
    @Body() body: unknown,
  ): Promise<PaymentRequestView> {
    const { plan } = parseBody(PaymentBody, body)
    return this.payments.request(accountOf(req), plan)
  }

  @Get('payments/:reference')
  checkPayment(
    @Req() req: AccountRequest,
    @Param('reference') reference: string,
  ): Promise<PaymentRequestView> {
    return this.payments.check(accountOf(req), reference)
  }
}
