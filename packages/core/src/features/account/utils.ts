import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  isRecord,
  sleep,
  TOKEN_PROGRAM_ID,
} from '../../core/shared'
import {
  DEFAULT_ACCOUNT_API_URL,
  ISO_MINUTE_LENGTH,
  NO_STATE_TEXT,
  TRANSFER_CHECKED_AMOUNT_OFFSET,
  TRANSFER_CHECKED_DATA_LENGTH,
  TRANSFER_CHECKED_DECIMALS_OFFSET,
  TRANSFER_CHECKED_TAG,
  USDC_DECIMALS,
  USDC_MINT,
  WatchEventType,
} from './constants'
import type { ApiResult, PaymentRequestView } from './types'

/**
 * `hosting-portability`: the service's base URL — the configured one when set, else the
 * default — without a trailing slash, so routes join onto it.
 */
export const accountApiUrl = (configured: string | undefined): string =>
  (configured?.trim() || DEFAULT_ACCOUNT_API_URL).replace(/\/+$/, '')

/** The `message` of a Nest error body (`{ message, statusCode }`), or null when there is none. */
export const errorMessageOf = (body: unknown): string | null =>
  isRecord(body) && typeof body['message'] === 'string' ? body['message'] : null

/** Whole USDC as base units. */
export const usdcBaseUnits = (usdc: number): bigint =>
  BigInt(Math.round(usdc * 10 ** USDC_DECIMALS))

/** The associated token account `owner` holds `mint` in (the SPL Token program's). */
export const associatedTokenAddress = (
  owner: PublicKey,
  mint: PublicKey,
): PublicKey =>
  PublicKey.findProgramAddressSync(
    [
      owner.toBuffer(),
      new PublicKey(TOKEN_PROGRAM_ID).toBuffer(),
      mint.toBuffer(),
    ],
    new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID),
  )[0]

/**
 * `usdc-plan-payment`: a Solana Pay USDC transfer — `TransferChecked` of the requested
 * amount from the payer's USDC account to the recipient's, with the request's reference
 * appended as a read-only, non-signer key so the service can find the transfer by it.
 */
export const usdcTransferInstruction = (
  payment: Pick<
    PaymentRequestView,
    'recipient' | 'amountUsdc' | 'reference' | 'network'
  >,
  payer: PublicKey,
): TransactionInstruction => {
  const mint = new PublicKey(USDC_MINT[payment.network])
  const data = new Uint8Array(TRANSFER_CHECKED_DATA_LENGTH)
  const view = new DataView(data.buffer)
  view.setUint8(0, TRANSFER_CHECKED_TAG)
  view.setBigUint64(
    TRANSFER_CHECKED_AMOUNT_OFFSET,
    usdcBaseUnits(payment.amountUsdc),
    true,
  )
  view.setUint8(TRANSFER_CHECKED_DECIMALS_OFFSET, USDC_DECIMALS)
  return new TransactionInstruction({
    programId: new PublicKey(TOKEN_PROGRAM_ID),
    keys: [
      {
        pubkey: associatedTokenAddress(payer, mint),
        isSigner: false,
        isWritable: true,
      },
      { pubkey: mint, isSigner: false, isWritable: false },
      {
        pubkey: associatedTokenAddress(new PublicKey(payment.recipient), mint),
        isSigner: false,
        isWritable: true,
      },
      { pubkey: payer, isSigner: true, isWritable: false },
      {
        pubkey: new PublicKey(payment.reference),
        isSigner: false,
        isWritable: false,
      },
    ],
    data: Buffer.from(data),
  })
}

/** The payment as one unsigned transaction; the wallet pays the network fee. */
export const usdcTransferTransaction = (
  payment: Pick<
    PaymentRequestView,
    'recipient' | 'amountUsdc' | 'reference' | 'network'
  >,
  payer: PublicKey,
): Transaction => new Transaction().add(usdcTransferInstruction(payment, payer))

/**
 * Re-checks a sent payment until the service reports it credited, refuses, or `attempts`
 * checks have passed — bounded, so the page never waits forever. Returns the last answer.
 */
export const pollUntilCredited = async (
  check: () => Promise<ApiResult<PaymentRequestView>>,
  attempts: number,
  intervalMs: number,
): Promise<ApiResult<PaymentRequestView>> => {
  const result = await check()
  if (!result.ok || result.value.credited || attempts <= 1) return result
  await sleep(intervalMs)
  return pollUntilCredited(check, attempts - 1, intervalMs)
}

/** Whether an event type is one this page has words for. */
export const isWatchEventType = (type: string): type is WatchEventType =>
  Object.values<string>(WatchEventType).includes(type)

/** An event's before/after state as compact JSON; a first sighting has no before. */
export const stateText = (state: unknown): string =>
  state === null || state === undefined ? NO_STATE_TEXT : JSON.stringify(state)

/** A service timestamp as `YYYY-MM-DD HH:MM UTC`, the same wherever the page is opened. */
export const formatUtcTime = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : `${date.toISOString().slice(0, ISO_MINUTE_LENGTH).replace('T', ' ')} UTC`
}
