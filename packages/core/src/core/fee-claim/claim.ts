import type { Connection, PublicKey, Transaction } from '@solana/web3.js'
import type BN from 'bn.js'
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { DynamicFeeSharingClient } from '@meteora-ag/dynamic-fee-sharing-sdk'
import { COMMITMENT, readyForWallet } from '../config-deploy'
import { errorMessage } from '../shared'
import { CLAIM_REASONS, FeeRole } from './constants'
import type { ClaimRequest, PrepareClaimResult } from './types'

/** The claim for the wallet's role: its own fees, a pool's fees into a royalty vault, or its share of one. */
const claimTransaction = (
  connection: Connection,
  client: DynamicBondingCurveClient,
  request: ClaimRequest,
  amounts: {
    pool: PublicKey
    payer: PublicKey
    maxBaseAmount: BN
    maxQuoteAmount: BN
  },
): Promise<Transaction> | null => {
  const vaults = new DynamicFeeSharingClient(connection, COMMITMENT)
  switch (request.role) {
    case FeeRole.Partner:
      return client.partner.claimPartnerTradingFee({
        ...amounts,
        feeClaimer: request.owner,
      })
    case FeeRole.Creator:
      return client.creator.claimCreatorTradingFee({
        ...amounts,
        creator: request.owner,
      })
    case FeeRole.VaultCollect:
      // The vault is the config's fee claimer; any of its recipients may trigger the claim.
      return request.vault && request.config
        ? vaults.fundByClaimDbcPartnerTradingFee({
            signer: request.owner,
            feeClaimer: request.vault,
            feeVault: request.vault,
            poolConfig: request.config,
            virtualPool: request.pool,
          })
        : null
    case FeeRole.VaultShare:
      return request.vault
        ? vaults.claimUserFee({
            feeVault: request.vault,
            user: request.owner,
            payer: request.owner,
          })
        : null
  }
}

/**
 * Builds the transaction that claims a pool's unclaimed trading fees for the connected
 * wallet, in the role it holds there, and dry-runs it. The wallet pays and receives;
 * nothing else signs.
 */
export const prepareFeeClaim = async (
  connection: Connection,
  request: ClaimRequest,
): Promise<PrepareClaimResult> => {
  const client = new DynamicBondingCurveClient(connection, COMMITMENT)
  const amounts = {
    pool: request.pool,
    payer: request.owner,
    maxBaseAmount: request.maxBaseAmount,
    maxQuoteAmount: request.maxQuoteAmount,
  }
  try {
    const transaction = await claimTransaction(
      connection,
      client,
      request,
      amounts,
    )
    if (!transaction) return { ok: false, reason: CLAIM_REASONS.noVault }
    const ready = await readyForWallet(
      connection,
      transaction,
      request.owner,
      [],
    )
    if (!ready.ok) return ready
    return {
      ok: true,
      claim: {
        ...ready.prepared,
        summary: {
          network: request.network,
          pool: request.pool.toBase58(),
          role: request.role,
          // Collecting moves the fees into the vault; every other claim pays the wallet.
          receiver:
            request.role === FeeRole.VaultCollect && request.vault
              ? request.vault.toBase58()
              : request.owner.toBase58(),
          quoteAmount: request.maxQuoteAmount.toString(),
          baseAmount: request.maxBaseAmount.toString(),
        },
      },
    }
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  }
}
