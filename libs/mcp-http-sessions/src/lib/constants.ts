/** The header a Streamable HTTP client sends to address its session. */
export const MCP_SESSION_HEADER = 'mcp-session-id'

/** JSON-RPC error code the MCP SDK's own examples use for a request with no usable session. */
export const NO_SESSION_ERROR_CODE = -32000

export const DEFAULT_MAX_SESSIONS = 1000
export const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000

export const NO_VALID_SESSION_MESSAGE = 'No valid session ID provided'
export const INVALID_SESSION_MESSAGE = 'Invalid or missing mcp-session-id'
export const TOO_MANY_SESSIONS_MESSAGE =
  'Too many open sessions; try again later'

/** HTTP statuses a request with no usable session is refused with. */
export enum NoSessionStatus {
  /** Unknown/foreign session, or a non-initialize request without one. */
  BAD_REQUEST = 400,
  /** An initialize request beyond `maxSessions`. */
  SERVICE_UNAVAILABLE = 503,
}
