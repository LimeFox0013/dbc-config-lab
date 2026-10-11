import { PublicKey } from '@solana/web3.js'
import type { Connection } from '@solana/web3.js'
import {
  createDbcProgram,
  DynamicBondingCurveClient,
  derivePartnerMetadata,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { COMMITMENT, readyForWallet } from '../config-deploy'
import { errorMessage } from '../shared'
import type {
  BrandingRequest,
  PartnerBranding,
  PrepareBrandingResult,
} from './types'
import { brandingRejection, trimmedBranding } from './utils'

/**
 * The branding written against a fee-claiming wallet, or null when it has none. One
 * account per wallet, at an address derived from it: one read over the public RPC.
 */
export const readPartnerBranding = async (
  connection: Connection,
  feeClaimer: string,
): Promise<PartnerBranding | null> => {
  const { program } = createDbcProgram(connection)
  const account = await program.account.partnerMetadata.fetchNullable(
    derivePartnerMetadata(new PublicKey(feeClaimer)),
  )
  return account
    ? { name: account.name, website: account.website, logo: account.logo }
    : null
}

/**
 * Builds the transaction that writes the branding against the connected wallet and
 * dry-runs it. The program creates the account once; a wallet that already has branding
 * is reported by the dry run.
 */
export const preparePartnerBranding = async (
  connection: Connection,
  request: BrandingRequest,
): Promise<PrepareBrandingResult> => {
  const rejection = brandingRejection(request.branding)
  if (rejection) return { ok: false, reason: rejection }
  try {
    const transaction = await new DynamicBondingCurveClient(
      connection,
      COMMITMENT,
    ).partner.createPartnerMetadata({
      ...trimmedBranding(request.branding),
      feeClaimer: request.owner,
      payer: request.owner,
    })
    return readyForWallet(connection, transaction, request.owner, [])
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  }
}
