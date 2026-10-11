/*
 * Pure-JS stand-in for bigint-buffer 1.1.5 (https://github.com/no2chem/bigint-buffer,
 * Apache-2.0, Copyright Michael Wei). These are that package's own JavaScript
 * conversions — the ones it runs whenever its native binding is not loaded, and the
 * whole of its browser build. The native binding, where CVE-2025-3194 lives, is left
 * out: nothing here touches memory outside a Buffer's bounds.
 */
/** A little-endian buffer as a BigInt. */
export function toBigIntLE(buf) {
  const reversed = Buffer.from(buf)
  reversed.reverse()
  const hex = reversed.toString('hex')
  if (hex.length === 0) return BigInt(0)
  return BigInt(`0x${hex}`)
}

/** A big-endian buffer as a BigInt. */
export function toBigIntBE(buf) {
  const hex = buf.toString('hex')
  if (hex.length === 0) return BigInt(0)
  return BigInt(`0x${hex}`)
}

/** A BigInt as a little-endian buffer of `width` bytes. */
export function toBufferLE(num, width) {
  const hex = num.toString(16)
  const buffer = Buffer.from(
    hex.padStart(width * 2, '0').slice(0, width * 2),
    'hex',
  )
  buffer.reverse()
  return buffer
}

/** A BigInt as a big-endian buffer of `width` bytes. */
export function toBufferBE(num, width) {
  const hex = num.toString(16)
  return Buffer.from(hex.padStart(width * 2, '0').slice(0, width * 2), 'hex')
}
