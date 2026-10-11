import type { PublicKey } from '@solana/web3.js'
import type { PreparedTransaction } from '../config-deploy'

/** A launchpad operator's public identity, kept on chain against their fee-claiming wallet. */
export interface PartnerBranding {
  name: string
  /** Empty, or an https URL. */
  website: string
  /** Empty, or an https image URL. */
  logo: string
}

export interface BrandingRequest {
  branding: PartnerBranding
  /** Pays, and is the fee claimer the branding is written against. */
  owner: PublicKey
}

export type PrepareBrandingResult =
  { ok: true; prepared: PreparedTransaction } | { ok: false; reason: string }
