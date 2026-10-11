import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AgenticAccountService } from './agentic-account.service.js'
import { REQUIRE_PERMISSION_METADATA_KEY } from './constants.js'
import type { RequestWithAgenticAccount } from './types.js'
import { readBearerToken } from './utils.js'

/**
 * Authenticates a request as an agentic account (never a shared/ambient
 * credential) and, when the route declares `@RequirePermission(...)`,
 * checks the account's role grants it.
 */
@Injectable()
export class AgenticAccountGuard implements CanActivate {
  constructor(
    private readonly agenticAccountService: AgenticAccountService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithAgenticAccount>()

    const rawKey = readBearerToken(request.headers['authorization'])

    if (!rawKey) {
      throw new UnauthorizedException('Missing agentic account credential')
    }

    const account = await this.agenticAccountService.authenticate(rawKey)

    if (!account) {
      throw new UnauthorizedException(
        'Invalid or revoked agentic account credential',
      )
    }

    const requiredPermission = this.reflector.get<string | undefined>(
      REQUIRE_PERMISSION_METADATA_KEY,
      context.getHandler(),
    )

    if (
      requiredPermission &&
      !account.permissions.includes(requiredPermission)
    ) {
      throw new ForbiddenException(
        `Agentic account's role does not grant '${requiredPermission}'`,
      )
    }

    request.agenticAccount = account
    return true
  }
}
