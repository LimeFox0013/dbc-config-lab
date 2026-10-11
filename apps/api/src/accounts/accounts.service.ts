import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { accounts, DRIZZLE_DB } from '../db'
import type { DrizzleDb } from '../db'
import { UsageService } from '../usage'
import { PLAN_LIMITS } from './constants'
import type { Account, AccountView } from './types'
import { effectivePlan } from './utils'

/** `wallet-sign-in` / `service-plans`: accounts, one per wallet, and the plan each is on. */
@Injectable()
export class AccountsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly usage: UsageService,
  ) {}

  /** The wallet's account, created on its first sign-in. */
  async findOrCreate(walletAddress: string): Promise<Account> {
    await this.db
      .insert(accounts)
      .values({ walletAddress })
      .onConflictDoNothing({ target: accounts.walletAddress })
    const [account] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.walletAddress, walletAddress))
    if (!account) throw new Error('Account was not created')
    return account
  }

  async get(accountId: string): Promise<Account | undefined> {
    const [account] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
    return account
  }

  /** The account's plan, its limits and today's usage. */
  async view(account: Account, now = new Date()): Promise<AccountView> {
    const plan = effectivePlan(account, now)
    const limits = PLAN_LIMITS[plan]
    return {
      walletAddress: account.walletAddress,
      plan,
      planEndsAt:
        account.planEndsAt && account.planEndsAt > now
          ? account.planEndsAt.toISOString()
          : null,
      callsToday: await this.usage.today(
        this.usage.callerForAccount(account.id),
        now,
      ),
      dailyCalls: limits.dailyCalls,
      watches: limits.watches,
    }
  }
}
