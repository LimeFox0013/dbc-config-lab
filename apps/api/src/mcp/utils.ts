import { BEARER_PREFIX, TOOL_CALL_METHOD } from './constants'

const isToolCall = (message: unknown): boolean =>
  typeof message === 'object' &&
  message !== null &&
  'method' in message &&
  message.method === TOOL_CALL_METHOD

/** Tool calls in a JSON-RPC body — one message or a batch. */
export const countToolCalls = (body: unknown): number =>
  (Array.isArray(body) ? body : [body]).filter(isToolCall).length

/** The API key in an `Authorization: Bearer …` header; undefined when none is presented. */
export const bearerKey = (header: string | undefined): string | undefined =>
  header?.toLowerCase().startsWith(BEARER_PREFIX.toLowerCase())
    ? header.slice(BEARER_PREFIX.length).trim()
    : undefined
