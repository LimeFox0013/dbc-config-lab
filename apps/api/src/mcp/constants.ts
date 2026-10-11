/** Open agent sessions at most; the hosted endpoint is public. */
export const MAX_MCP_SESSIONS = 500

export const MCP_IDLE_TIMEOUT_MS = 15 * 60 * 1000

/** The JSON-RPC method that runs a tool — the only one counted against the allowance. */
export const TOOL_CALL_METHOD = 'tools/call'

/** JSON-RPC error code for a refused call (implementation-defined server error range). */
export const ALLOWANCE_ERROR_CODE = -32001

/** JSON-RPC error code for a key that does not authenticate. */
export const INVALID_KEY_ERROR_CODE = -32002

/** Readable refusals; each names the limit it enforces. */
export const MCP_TEXT = {
  addressAllowance: (limit: number): string =>
    `Today's free allowance of ${limit} tool calls for this address is used up. It resets at 00:00 UTC; an API key on a paid plan raises it.`,
  accountAllowance: (limit: number): string =>
    `Today's allowance of ${limit} tool calls on this account's plan is used up. It resets at 00:00 UTC.`,
  invalidKey: 'This API key is not valid. It may have been revoked.',
} as const

/** The scheme an API key is presented with. */
export const BEARER_PREFIX = 'Bearer '

export const JSONRPC_VERSION = '2.0'

/** Counted as the caller's address when the request carries none. */
export const UNKNOWN_ADDRESS = 'unknown'
