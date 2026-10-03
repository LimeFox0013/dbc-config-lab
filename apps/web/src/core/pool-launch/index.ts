import { Keypair, PublicKey } from '@solana/web3.js'
import type { Connection } from '@solana/web3.js'
import BN from 'bn.js'
import {
  deriveDbcPoolAddress,
  DynamicBondingCurveClient,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { COMMITMENT, configTerms, readyForWallet } from '../config-deploy'
import { quoteFirstBuy } from '../launch-simulator'
import {
  QUOTE_TOKENS,
  quoteUnitsFromSol,
  wholeQuoteTokens,
} from '../quote-token'
import { errorMessage } from '../shared'
import type { LaunchRequest, LaunchSummary, PrepareLaunchResult } from './types'
import { metadataRejection, minimumFirstBuyOut, trimmedMetadata } from './utils'

export {
  FIRST_BUY_SLIPPAGE_BPS,
  METADATA_LIMITS,
  MetadataRejection,
  PARTNER_AUTHORITY_OPTIONS,
} from './constants'
export type {
  LaunchRequest,
  LaunchSummary,
  PreparedLaunch,
  PrepareLaunchResult,
  TokenMetadata,
} from './types'
export { metadataRejection } from './utils'

/**
 * Builds the transaction that launches a token on an existing config — a fresh mint, its
 * pool, and optionally the creator's first buy in the same transaction — for the
 * connected wallet, signs it with the one-off mint key and dry-runs it on the target
 * network. The first buy is quoted with the simulator before anything is signed.
 */
export const preparePoolLaunch = async (
  connection: Connection,
  request: LaunchRequest,
): Promise<PrepareLaunchResult> => {
  const rejection = metadataRejection(request.metadata)
  if (rejection) return { ok: false, reason: rejection }
  if (!Number.isFinite(request.firstBuy) || request.firstBuy < 0)
    return { ok: false, reason: 'The first buy must be zero or more.' }

  const quote = QUOTE_TOKENS[request.quoteToken]
  const quoteMint = new PublicKey(quote.mints[request.network])
  const metadata = trimmedMetadata(request.metadata)
  const mintKey = Keypair.generate()
  const poolAddress = deriveDbcPoolAddress(
    quoteMint,
    mintKey.publicKey,
    request.configAddress,
  )
  // Budgets elsewhere are written in SOL; here the user types quote tokens directly.
  const buyAmount = quoteUnitsFromSol(
    request.firstBuy * quote.solPerToken,
    request.quoteToken,
  )
  const firstBuy = buyAmount.isZero()
    ? null
    : quoteFirstBuy(request.parameters, buyAmount)
  const tokens = (units: BN): number =>
    Number(units.toString()) / 10 ** request.parameters.tokenDecimal

  try {
    const transaction = await new DynamicBondingCurveClient(
      connection,
      COMMITMENT,
    ).creator.createPoolWithFirstBuy({
      createPoolParam: {
        ...metadata,
        payer: request.owner,
        poolCreator: request.owner,
        config: request.configAddress,
        baseMint: mintKey.publicKey,
      },
      ...(firstBuy
        ? {
            firstBuyParam: {
              buyer: request.owner,
              buyAmount,
              minimumAmountOut: minimumFirstBuyOut(firstBuy.amountOut),
              referralTokenAccount: null,
            },
          }
        : {}),
    })
    const ready = await readyForWallet(connection, transaction, request.owner, [
      mintKey,
    ])
    if (!ready.ok) return ready

    const summary: LaunchSummary = {
      network: request.network,
      configAddress: request.configAddress.toBase58(),
      poolAddress: poolAddress.toBase58(),
      mintAddress: mintKey.publicKey.toBase58(),
      creator: request.owner.toBase58(),
      metadata,
      quoteToken: request.quoteToken,
      terms: configTerms(request.parameters, request.quoteToken),
      firstBuy: firstBuy && {
        amount: wholeQuoteTokens(firstBuy.amountInUsed, request.quoteToken),
        expectedTokens: tokens(firstBuy.amountOut),
        minimumTokens: tokens(minimumFirstBuyOut(firstBuy.amountOut)),
        baseFeeBps: firstBuy.baseFeeBps,
        atMinimumFee: firstBuy.atMinimumFee,
      },
    }
    return { ok: true, launch: { ...ready.prepared, summary } }
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  }
}
