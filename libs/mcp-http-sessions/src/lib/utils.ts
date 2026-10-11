import type { IncomingMessage, ServerResponse } from 'node:http'
import { MCP_SESSION_HEADER, NO_SESSION_ERROR_CODE } from './constants.js'
import type { NoSessionStatus } from './constants.js'

/** The session id a request names, if any. */
export const readSessionId = (req: IncomingMessage): string | undefined => {
  const value = req.headers[MCP_SESSION_HEADER]
  return Array.isArray(value) ? value[0] : value
}

/** A JSON-RPC error response with no request id, as the SDK's own examples send it. */
export const sendJsonRpcError = (
  res: ServerResponse,
  status: NoSessionStatus,
  message: string,
): void => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: NO_SESSION_ERROR_CODE, message },
      id: null,
    }),
  )
}
