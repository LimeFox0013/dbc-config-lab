import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common'
import type { OnModuleDestroy } from '@nestjs/common'
import type { Request, Response } from 'express'
import { createLabServer } from '@dbc-config-lab/core/mcp'
import { McpSessionManager } from '@lf/mcp-http-sessions'
import {
  AccountsService,
  KeysService,
  PLAN_LIMITS,
  PlanId,
  planLimits,
} from '../accounts'
import { UsageService } from '../usage'
import {
  ALLOWANCE_ERROR_CODE,
  INVALID_KEY_ERROR_CODE,
  JSONRPC_VERSION,
  MAX_MCP_SESSIONS,
  MCP_IDLE_TIMEOUT_MS,
  MCP_TEXT,
  UNKNOWN_ADDRESS,
} from './constants'
import type { Caller } from './types'
import { bearerKey, countToolCalls } from './utils'

/**
 * `hosted-agent-tools`: the lab's agent tools over MCP Streamable HTTP — the
 * same server the local npx package runs, so tools, inputs and figures match;
 * like it, nothing here holds a key, signs or sends a transaction.
 */
@Controller('mcp')
export class McpController implements OnModuleDestroy {
  private readonly sessions = new McpSessionManager<Request>({
    createServer: () => createLabServer(),
    maxSessions: MAX_MCP_SESSIONS,
    idleTimeoutMs: MCP_IDLE_TIMEOUT_MS,
  })

  constructor(
    private readonly usage: UsageService,
    private readonly keys: KeysService,
    private readonly accounts: AccountsService,
  ) {}

  /**
   * `api-keys` / `service-plans`: a request with a key is its account's, on
   * that account's plan; without one, it is its network address's, on the
   * free allowance. A key that does not authenticate is refused outright.
   */
  private async callerOf(req: Request): Promise<Caller | null> {
    const key = bearerKey(req.headers.authorization)
    if (key === undefined) {
      return {
        id: this.usage.callerForAddress(req.ip ?? UNKNOWN_ADDRESS),
        dailyCalls: PLAN_LIMITS[PlanId.Free].dailyCalls,
        keyed: false,
      }
    }
    const accountId = await this.keys.accountForKey(key)
    const account = accountId ? await this.accounts.get(accountId) : undefined
    if (!account) return null
    return {
      id: this.usage.callerForAccount(account.id),
      dailyCalls: planLimits(account, new Date()).dailyCalls,
      keyed: true,
    }
  }

  private refuse(
    res: Response,
    status: HttpStatus,
    code: number,
    message: string,
  ): void {
    res
      .status(status)
      .json({ jsonrpc: JSONRPC_VERSION, error: { code, message }, id: null })
  }

  @Post()
  async post(@Req() req: Request, @Res() res: Response): Promise<void> {
    const caller = await this.callerOf(req)
    if (!caller) {
      this.refuse(
        res,
        HttpStatus.UNAUTHORIZED,
        INVALID_KEY_ERROR_CODE,
        MCP_TEXT.invalidKey,
      )
      return
    }
    const calls = countToolCalls(req.body)
    if (calls > 0) {
      const total = await this.usage.record(caller.id, calls)
      if (total > caller.dailyCalls) {
        this.refuse(
          res,
          HttpStatus.TOO_MANY_REQUESTS,
          ALLOWANCE_ERROR_CODE,
          (caller.keyed
            ? MCP_TEXT.accountAllowance
            : MCP_TEXT.addressAllowance)(caller.dailyCalls),
        )
        return
      }
    }
    await this.sessions.handlePost(req, res, req.body)
  }

  @Get()
  async stream(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.sessions.handleSessionRequest(req, res)
  }

  @Delete()
  async end(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.sessions.handleSessionRequest(req, res)
  }

  async onModuleDestroy(): Promise<void> {
    await this.sessions.closeAll()
  }
}
