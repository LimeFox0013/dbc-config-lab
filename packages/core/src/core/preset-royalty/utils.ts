import { PublicKey } from '@solana/web3.js'
import { CollectFeeMode } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { ROYALTY_PERCENT_LIMITS, RoyaltyRejection } from './constants'
import type { PresetRoyalty } from './types'

/** Any valid address but the default one — a multisig vault (off the curve) can be an author too. */
const isAddress = (value: string): boolean => {
  try {
    return !new PublicKey(value).equals(PublicKey.default)
  } catch {
    return false
  }
}

/** The first reason this royalty cannot be paid on this config, or null when it can. */
export const royaltyRejection = (
  royalty: PresetRoyalty,
  parameters: ConfigParameters,
  deployer?: PublicKey,
): RoyaltyRejection | null => {
  if (!isAddress(royalty.author)) return RoyaltyRejection.AuthorInvalid
  if (deployer && deployer.toBase58() === royalty.author)
    return RoyaltyRejection.AuthorIsDeployer
  if (
    !Number.isInteger(royalty.sharePercent) ||
    royalty.sharePercent < ROYALTY_PERCENT_LIMITS.min ||
    royalty.sharePercent > ROYALTY_PERCENT_LIMITS.max
  )
    return RoyaltyRejection.ShareOutOfRange
  if (parameters.collectFeeMode !== CollectFeeMode.QuoteToken)
    return RoyaltyRejection.FeesInLaunchedToken
  return null
}
