// Types
export type { SsrfError } from './lib/types.js'

// Constants & codes
export {
  SsrfErrorCode,
  ALLOWED_PROTOCOLS,
  SAFE_FETCH_TIMEOUT_MS,
} from './lib/constants.js'

// Core utilities
export { isPrivateIp } from './lib/private-ip.js'
export { sanitizeUrl } from './lib/sanitize-url.js'
export { safeFetch } from './lib/safe-fetch.js'
