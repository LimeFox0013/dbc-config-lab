import { PublicKey } from '@solana/web3.js'
import { isRecord } from '../shared'

/** Mints of the NFTs among parsed token accounts: exactly one token, no decimals. */
export const nftMintsOf = (
  accounts: ReadonlyArray<{ account: { data: { parsed: unknown } } }>,
): PublicKey[] =>
  accounts.flatMap(({ account }) => {
    const parsed = account.data.parsed
    const info = isRecord(parsed) ? parsed['info'] : null
    if (!isRecord(info)) return []
    const amount = info['tokenAmount']
    const mint = info['mint']
    const isNft =
      isRecord(amount) && amount['amount'] === '1' && amount['decimals'] === 0
    return isNft && typeof mint === 'string' ? [new PublicKey(mint)] : []
  })
