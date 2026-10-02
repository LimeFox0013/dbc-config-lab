import { Buffer } from 'buffer/'

/** Solana libraries expect Node's global `Buffer`; must run before any of them load. */
export const setupBuffer = (): void => {
  if ('Buffer' in globalThis) return
  Object.defineProperty(globalThis, 'Buffer', {
    value: Buffer,
    writable: true,
    configurable: true,
  })
}
