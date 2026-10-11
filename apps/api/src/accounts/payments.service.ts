import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { Keypair, PublicKey } from '@solana/web3.js'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { rpcConnection } from '@dbc-config-lab/core/mcp'
import { errorMessage } from '@dbc-config-lab/core/core/shared'
import type { SolanaNetwork } from '@dbc-config-lab/core/core/shared'
import { accounts, DRIZZLE_DB, payments } from '../db'
import type { DrizzleDb } from '../db'
import { networkOf } from '../utils'
import {
  ACCOUNT_TEXT,
  AccountEnv,
  OPEN_PAYMENT_WINDOW_MS,
  OPEN_PAYMENTS_PER_RUN,
  PAID_PLAN_TERMS,
  PAYMENT_COMMITMENT,
  PlanId,
  REFERENCE_SIGNATURE_LIMIT,
  USDC_MINT,
} from './constants'
import type {
  Account,
  PaymentRequestView,
  PaymentRow,
  TransferReader,
} from './types'
import {
  extendedPlanEnd,
  isPaidPlan,
  paymentView,
  paysInFull,
  usdcBaseUnits,
} from './utils'

/**
 * `usdc-plan-payment`: Solana Pay transfer requests. The account's wallet signs
 * and sends; the service only reads the chain, and credits a plan once per
 * finalized transfer that carries the request's reference.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  private network(): SolanaNetwork {
    return networkOf(process.env[AccountEnv.PayNetwork])
  }

  private recipient(): string {
    const recipient = process.env[AccountEnv.PayRecipient]
    if (!recipient)
      throw new ServiceUnavailableException(ACCOUNT_TEXT.paymentsOff)
    return recipient
  }

  /** What reads transfers from the chain; replaceable in tests. */
  protected connection(network: SolanaNetwork): TransferReader {
    return rpcConnection(network)
  }

  /** A new transfer request for `plan`, unique by its reference. */
  async request(account: Account, plan: PlanId): Promise<PaymentRequestView> {
    const terms = PAID_PLAN_TERMS[plan]
    if (!terms) throw new NotFoundException(ACCOUNT_TEXT.unknownPlan)
    const row = {
      reference: Keypair.generate().publicKey.toBase58(),
      accountId: account.id,
      plan,
      amount: usdcBaseUnits(terms.priceUsdc),
      recipient: this.recipient(),
      network: this.network(),
    }
    await this.db.insert(payments).values(row)
    return paymentView(
      { ...row, signature: null, createdAt: new Date(), creditedAt: null },
      account,
    )
  }

  /**
   * The request's state, crediting the plan if its transfer is now finalized.
   * Safe to call repeatedly: the credit happens at most once.
   */
  async check(
    account: Account,
    reference: string,
  ): Promise<PaymentRequestView> {
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.reference, reference),
          eq(payments.accountId, account.id),
        ),
      )
    if (!payment) throw new NotFoundException(ACCOUNT_TEXT.paymentNotFound)
    if (payment.creditedAt) return paymentView(payment, account)

    const signature = await this.findTransfer(payment)
    if (!signature) return paymentView(payment, account)
    const credited = await this.credit(payment, signature)
    return paymentView(credited.payment, credited.account)
  }

  /**
   * Credits every recent uncredited request whose transfer is now finalized —
   * called by the poller, so a payer who leaves before the site sees the credit
   * is still credited. Returns how many were credited.
   */
  async creditOpen(now = new Date()): Promise<number> {
    const open = await this.db
      .select()
      .from(payments)
      .where(
        and(
          isNull(payments.creditedAt),
          gt(
            payments.createdAt,
            new Date(now.getTime() - OPEN_PAYMENT_WINDOW_MS),
          ),
        ),
      )
      .orderBy(desc(payments.createdAt))
      .limit(OPEN_PAYMENTS_PER_RUN)
    let credited = 0
    for (const payment of open) {
      try {
        const signature = await this.findTransfer(payment)
        if (!signature) continue
        await this.credit(payment, signature)
        credited += 1
      } catch (e) {
        this.logger.warn(
          `Payment ${payment.reference} not checked (${errorMessage(e)})`,
        )
      }
    }
    return credited
  }

  /** The finalized transaction that pays this request in full, if there is one yet. */
  private async findTransfer(payment: PaymentRow): Promise<string | null> {
    const network = networkOf(payment.network)
    const connection = this.connection(network)
    const candidates = await connection.getSignaturesForAddress(
      new PublicKey(payment.reference),
      { limit: REFERENCE_SIGNATURE_LIMIT },
      PAYMENT_COMMITMENT,
    )
    for (const candidate of candidates) {
      if (candidate.err) continue
      const transaction = await connection.getParsedTransaction(
        candidate.signature,
        {
          commitment: PAYMENT_COMMITMENT,
          maxSupportedTransactionVersion: 0,
        },
      )
      if (transaction && paysInFull(transaction, payment, USDC_MINT[network])) {
        return candidate.signature
      }
    }
    return null
  }

  /** Records the transfer and extends the plan, in one transaction; a second credit is a no-op. */
  private async credit(
    payment: PaymentRow,
    signature: string,
  ): Promise<{ payment: PaymentRow; account: Account }> {
    return this.db.transaction(async (tx) => {
      const now = new Date()
      const [claimed] = await tx
        .update(payments)
        .set({ signature, creditedAt: now })
        .where(
          and(
            eq(payments.reference, payment.reference),
            isNull(payments.creditedAt),
          ),
        )
        .returning()
      const [account] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, payment.accountId))
        .for('update')
      if (!account) throw new NotFoundException(ACCOUNT_TEXT.paymentNotFound)
      const terms = isPaidPlan(payment.plan)
        ? PAID_PLAN_TERMS[payment.plan]
        : undefined
      if (!claimed || !terms) return { payment: claimed ?? payment, account }

      const [updated] = await tx
        .update(accounts)
        .set({
          paidPlan: payment.plan,
          planEndsAt: extendedPlanEnd(
            account.planEndsAt,
            now,
            terms.periodDays,
          ),
        })
        .where(eq(accounts.id, account.id))
        .returning()
      return { payment: claimed, account: updated ?? account }
    })
  }
}
