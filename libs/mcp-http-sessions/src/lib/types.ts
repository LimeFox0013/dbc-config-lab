import type { IncomingMessage } from 'node:http'
import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'

/**
 * What the manager needs of a server: connecting it to one session's
 * transport. An SDK `McpServer` satisfies it — typed structurally so a
 * consumer resolving the SDK's ESM build and this library resolving its
 * CommonJS build (a `nodenext` ESM app) still agree.
 */
export interface ConnectableMcpServer {
  connect(transport: Transport): Promise<void>
}

export interface McpSessionManagerOptions<R extends IncomingMessage> {
  /**
   * A fresh server for one protocol session. Anything about the caller
   * (identity, tenant, quota key) is read from the initializing request here
   * and bound once — never re-derived from a later client-supplied argument.
   */
  createServer: (req: R) => ConnectableMcpServer | Promise<ConnectableMcpServer>
  /** Open sessions at most; an initialize request beyond it is refused with 503. */
  maxSessions?: number
  /** A session with no request for this long is closed. */
  idleTimeoutMs?: number
  /**
   * Who is calling, read from every request (e.g. the authenticated account
   * id). When set, a session answers only the caller that initialized it: a
   * request naming another caller's session is refused exactly like an
   * unknown session, so its existence is never revealed. Return `undefined`
   * for a request with no identifiable caller rather than throwing: it
   * matches no session, so it is refused the same way.
   */
  callerKey?: (req: R) => string | undefined
  /** Clock, for tests. */
  now?: () => number
}

/** One open protocol session, as the manager tracks it. */
export interface Session {
  transport: StreamableHTTPServerTransport
  lastSeen: number
  /** The `callerKey` of the request that initialized it, when keyed. */
  caller: string | undefined
}
