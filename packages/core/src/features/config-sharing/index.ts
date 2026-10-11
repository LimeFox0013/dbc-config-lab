export { MAX_SHARE_LENGTH, ShareRejection } from './constants'
export type { DecodeResult, Reader, SharedConfig } from './types'
export { boolean, finiteNumber, optional, record } from './readers'
export {
  decodeSharedConfig,
  encodeSharedConfig,
  readSharedConfig,
  shareLink,
  sharedFromHash,
  toTypeScript,
} from './utils'
