import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import {
  DEFAULT_IDLE_TIMEOUT_MS,
  DEFAULT_MAX_SESSIONS,
  INVALID_SESSION_MESSAGE,
  NO_VALID_SESSION_MESSAGE,
  NoSessionStatus,
  TOO_MANY_SESSIONS_MESSAGE,
} from './constants.js'
import type { McpSessionManagerOptions, Session } from './types.js'
import { readSessionId, sendJsonRpcError } from './utils.js'

/**
 * One MCP server per protocol session over Streamable HTTP: a POST without a
 * session must be an initialize request and opens one; every later request
 * names its session and is routed to it. Sessions are capped and closed when
 * idle, so a public endpoint cannot be exhausted by abandoned sessions.
 * With `callerKey`, a session is bound to the caller that opened it.
 * Framework-free — a controller (NestJS, Express, plain node) owns auth and
 * passes the raw request/response through.
 */
export class McpSessionManager<R extends IncomingMessage = IncomingMessage> {
  private readonly sessions = new Map<string, Session>()
  private readonly maxSessions: number
  private readonly idleTimeoutMs: number
  private readonly now: () => number

  constructor(private readonly options: McpSessionManagerOptions<R>) {
    this.maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS
    this.now = options.now ?? Date.now
  }

  get sessionCount(): number {
    return this.sessions.size
  }

  async handlePost(req: R, res: ServerResponse, body: unknown): Promise<void> {
    await this.closeIdle()
    const sessionId = readSessionId(req)
    const existing = this.sessionFor(req, sessionId)
    if (existing) {
      existing.lastSeen = this.now()
      await existing.transport.handleRequest(req, res, body)
      return
    }
    if (sessionId || !isInitializeRequest(body)) {
      sendJsonRpcError(
        res,
        NoSessionStatus.BAD_REQUEST,
        NO_VALID_SESSION_MESSAGE,
      )
      return
    }
    if (this.sessions.size >= this.maxSessions) {
      sendJsonRpcError(
        res,
        NoSessionStatus.SERVICE_UNAVAILABLE,
        TOO_MANY_SESSIONS_MESSAGE,
      )
      return
    }

    const caller = this.options.callerKey?.(req)

    const transport: StreamableHTTPServerTransport =
      new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          this.sessions.set(id, { transport, lastSeen: this.now(), caller })
        },
      })
    transport.onclose = () => {
      if (transport.sessionId) this.sessions.delete(transport.sessionId)
    }
    const server = await this.options.createServer(req)
    await server.connect(transport)
    await transport.handleRequest(req, res, body)
  }

  /** GET (the server-to-client stream) and DELETE (ending a session). */
  async handleSessionRequest(req: R, res: ServerResponse): Promise<void> {
    await this.closeIdle()
    const session = this.sessionFor(req, readSessionId(req))
    if (!session) {
      sendJsonRpcError(
        res,
        NoSessionStatus.BAD_REQUEST,
        INVALID_SESSION_MESSAGE,
      )
      return
    }
    session.lastSeen = this.now()
    await session.transport.handleRequest(req, res)
  }

  /** Closes every open session, e.g. on shutdown. */
  async closeAll(): Promise<void> {
    const open = [...this.sessions.values()]
    this.sessions.clear()
    await Promise.all(open.map(({ transport }) => transport.close()))
  }

  /** The named session, unless it belongs to another caller — then none, as if unknown. */
  private sessionFor(
    req: R,
    sessionId: string | undefined,
  ): Session | undefined {
    const session = sessionId ? this.sessions.get(sessionId) : undefined
    if (!session || !this.options.callerKey) return session
    const caller = this.options.callerKey(req)
    return caller !== undefined && caller === session.caller
      ? session
      : undefined
  }

  private async closeIdle(): Promise<void> {
    const cutoff = this.now() - this.idleTimeoutMs
    const idle = [...this.sessions.entries()].filter(
      ([, session]) => session.lastSeen < cutoff,
    )
    idle.forEach(([id]) => this.sessions.delete(id))
    await Promise.all(idle.map(([, { transport }]) => transport.close()))
  }
}
