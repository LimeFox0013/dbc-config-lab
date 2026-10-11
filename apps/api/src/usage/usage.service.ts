import { Inject, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import { dailyUsage, DRIZZLE_DB } from '../db'
import type { DrizzleDb } from '../db'
import { requiredEnv } from '../utils'
import { ACCOUNT_CALLER_PREFIX, CALLER_HASH_KEY_ENV } from './constants'
import { addressCaller, utcDay } from './utils'

/** `hosted-agent-tools`: counts each caller's tool calls per UTC day. */
@Injectable()
export class UsageService {
  private readonly hashKey: string

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {
    this.hashKey = requiredEnv(CALLER_HASH_KEY_ENV)
  }

  callerForAddress(address: string): string {
    return addressCaller(address, this.hashKey)
  }

  /** `service-plans`: an account's calls are counted under its own id, whichever key made them. */
  callerForAccount(accountId: string): string {
    return `${ACCOUNT_CALLER_PREFIX}${accountId}`
  }

  /** Today's count for `caller` so far. */
  async today(caller: string, now = new Date()): Promise<number> {
    const [row] = await this.db
      .select({ calls: dailyUsage.calls })
      .from(dailyUsage)
      .where(
        and(eq(dailyUsage.caller, caller), eq(dailyUsage.day, utcDay(now))),
      )
    return row?.calls ?? 0
  }

  /** Adds `calls` to today's count for `caller` and returns the new total. */
  async record(
    caller: string,
    calls: number,
    now = new Date(),
  ): Promise<number> {
    const [row] = await this.db
      .insert(dailyUsage)
      .values({ caller, day: utcDay(now), calls })
      .onConflictDoUpdate({
        target: [dailyUsage.caller, dailyUsage.day],
        set: { calls: sql`${dailyUsage.calls} + ${calls}` },
      })
      .returning({ calls: dailyUsage.calls })
    return row?.calls ?? calls
  }
}
