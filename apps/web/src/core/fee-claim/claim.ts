import type { Connection } from '@solana/web3.js'
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { COMMITMENT, readyForWallet } from '../config-deploy'
import { errorMessage } from '../shared'
import { FeeRole } from './constants'
import type { ClaimRequest, PrepareClaimResult } from './types'

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
    const transaction =
      request.role === FeeRole.Partner
        ? await client.partner.claimPartnerTradingFee({
            ...amounts,
            feeClaimer: request.owner,
          })
        : await client.creator.claimCreatorTradingFee({
            ...amounts,
            creator: request.owner,
          })
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
          receiver: request.owner.toBase58(),
          quoteAmount: request.maxQuoteAmount.toString(),
          baseAmount: request.maxBaseAmount.toString(),
        },
      },
    }
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  }
}
