import { createHmac } from 'node:crypto'
import { resolve } from 'node:path'
import { Keypair } from '@solana/web3.js'
import { SolanaNetwork } from '@dbc-config-lab/core/core/shared'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { AccountsService } from '../accounts/accounts.service'
import { PaymentsService } from '../accounts/payments.service'
import { PLAN_LIMITS, PlanId } from '../accounts/constants'
import type { Account } from '../accounts/types'
import { eq } from 'drizzle-orm'
import { accounts as accountRows } from '../db'
import { DatabaseService } from '../db/database.service'
import { UsageService } from '../usage'
import {
  DeliveryStatus,
  MAX_DELIVERY_ATTEMPTS,
  MAX_ENDPOINTS_PER_ACCOUNT,
  WEBHOOK_TEXT,
  WebhookHeader,
} from '../webhooks/constants'
import { WebhooksService } from '../webhooks/webhooks.service'
import { ChainService } from './chain.service'
import { WatchEventType, WatchKind } from './constants'
import { PollerService } from './poller.service'
import type { ConfigState, FeeWalletState } from './types'
import { WatchesService } from './watches.service'

/** Against a real Postgres; runs when TEST_DATABASE_URL names a scratch database. */
const url = process.env['TEST_DATABASE_URL']
/** Concurrent transactions need a server that takes several connections (not PGlite's socket server). */
const concurrent = process.env['TEST_DATABASE_CONCURRENT'] === '1'

class FakeChain extends ChainService {
  configs = new Map<string, ConfigState>()
  wallets = new Map<string, FeeWalletState>()
  override async configState(
    _network: unknown,
    address: string,
  ): Promise<ConfigState> {
    const state = this.configs.get(address)
    if (!state) throw new Error('unreadable')
    return state
  }
  override async feeWalletState(
    _network: unknown,
    owner: string,
  ): Promise<FeeWalletState> {
    return this.wallets.get(owner) ?? { unclaimedSol: 0 }
  }
}

/** Records what would have been sent; answers with the next queued status. */
class RecordingWebhooks extends WebhooksService {
  sent: { url: string; headers: Record<string, string>; body: string }[] = []
  replies: (number | null)[] = []
  protected override async send(
    target: string,
    headers: Record<string, string>,
    body: string,
  ): Promise<{ status: number | null; error: string | null }> {
    this.sent.push({ url: target, headers, body })
    const status = this.replies.shift() ?? 200
    return { status, error: status !== null && status < 300 ? null : 'failed' }
  }
}

describe.skipIf(!url)('watches and webhooks against Postgres', () => {
  let database: DatabaseService
  let accounts: AccountsService
  let watches: WatchesService
  let webhooks: RecordingWebhooks
  let chain: FakeChain
  let payments: PaymentsService
  let poller: PollerService

  beforeAll(async () => {
    process.env['DATABASE_URL'] = url
    process.env['MIGRATIONS_DIR'] = resolve(__dirname, '../../drizzle')
    process.env['CALLER_HASH_KEY'] = 'test-hash-key'
    database = new DatabaseService()
    await database.onModuleInit()
    const db = database.db
    accounts = new AccountsService(db, new UsageService(db))
    watches = new WatchesService(db)
    webhooks = new RecordingWebhooks(db)
    chain = new FakeChain()
    payments = new PaymentsService(db)
    poller = new PollerService(db, database, chain, webhooks, payments)
  })
  afterAll(async () => {
    await database?.onModuleDestroy()
  })

  const newAccount = (): Promise<Account> =>
    accounts.findOrCreate(Keypair.generate().publicKey.toBase58())
  const address = (): string => Keypair.generate().publicKey.toBase58()

  it('never lets an account hold more watches than its plan allows', async () => {
    const account = await newAccount()
    const limit = PLAN_LIMITS[PlanId.Free].watches
    for (let i = 0; i < limit; i++)
      await watches.add(account, {
        kind: WatchKind.Config,
        target: address(),
        network: SolanaNetwork.Devnet,
      })
    await expect(
      watches.add(account, {
        kind: WatchKind.Config,
        target: address(),
        network: SolanaNetwork.Devnet,
      }),
    ).rejects.toThrow(`allows ${limit} watches`)
  })

  it.skipIf(!concurrent)(
    'holds the limit when adds race each other',
    async () => {
      const account = await newAccount()
      const limit = PLAN_LIMITS[PlanId.Free].watches
      const results = await Promise.allSettled(
        Array.from({ length: limit + 3 }, () =>
          watches.add(account, {
            kind: WatchKind.Config,
            target: address(),
            network: SolanaNetwork.Devnet,
          }),
        ),
      )
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(
        limit,
      )
      expect(await watches.list(account.id)).toHaveLength(limit)
    },
  )

  it("counts paused watches, and pauses and deletes only the account's own", async () => {
    const account = await newAccount()
    const other = await newAccount()
    const limit = PLAN_LIMITS[PlanId.Free].watches
    const added = []
    for (let i = 0; i < limit; i++)
      added.push(
        await watches.add(account, {
          kind: WatchKind.Config,
          target: address(),
          network: SolanaNetwork.Devnet,
        }),
      )
    const [first, second] = added
    if (!first || !second) throw new Error('no watches')
    expect((await watches.setPaused(account.id, first.id, true)).paused).toBe(
      true,
    )
    await expect(
      watches.add(account, {
        kind: WatchKind.Config,
        target: address(),
        network: SolanaNetwork.Devnet,
      }),
    ).rejects.toThrow('paused ones included')

    await expect(watches.setPaused(other.id, second.id, true)).rejects.toThrow(
      'No such watch',
    )
    await expect(watches.remove(other.id, second.id)).rejects.toThrow(
      'No such watch',
    )
    await watches.remove(account.id, second.id)
    expect((await watches.list(account.id)).map((w) => w.id)).not.toContain(
      second.id,
    )
  })

  it('checks only the oldest watches within the plan once a paid plan lapses', async () => {
    const account = await newAccount()
    const paidUntil = new Date(Date.now() + 86_400_000)
    await database.db
      .update(accountRows)
      .set({ paidPlan: PlanId.Pro, planEndsAt: paidUntil })
      .where(eq(accountRows.id, account.id))
    const paid = { ...account, paidPlan: PlanId.Pro, planEndsAt: paidUntil }
    const free = PLAN_LIMITS[PlanId.Free].watches
    const targets = Array.from({ length: free + 2 }, address)
    for (const target of targets) {
      chain.configs.set(target, { totalPools: 0, graduated: 0, risks: [] })
      await watches.add(paid, {
        kind: WatchKind.Config,
        target,
        network: SolanaNetwork.Devnet,
      })
    }
    const checked = async (): Promise<string[]> =>
      (await watches.list(account.id))
        .filter((w) => w.lastCheckedAt !== null)
        .map((w) => w.target)

    await poller.checkWatches(new Date(paidUntil.getTime() + 1))
    expect(await checked()).toEqual(targets.slice(0, free))
    await poller.checkWatches()
    expect(await checked()).toEqual(targets)
  })

  it('records each change once and delivers it, signed, to the account', async () => {
    const account = await newAccount()
    const config = address()
    const { secret } = await webhooks.register(
      account.id,
      'https://example.com/lab',
    )
    await watches.add(account, {
      kind: WatchKind.Config,
      target: config,
      network: SolanaNetwork.Devnet,
    })
    const [watch] = await database.db.query.watches.findMany({
      where: (w, { eq }) => eq(w.accountId, account.id),
    })
    if (!watch) throw new Error('no watch')

    chain.configs.set(config, { totalPools: 2, graduated: 0, risks: [] })
    expect(await poller.check(watch)).toEqual([]) // baseline
    const [afterBaseline] = await database.db.query.watches.findMany({
      where: (w, { eq }) => eq(w.id, watch.id),
    })
    if (!afterBaseline) throw new Error('no watch')

    chain.configs.set(config, { totalPools: 3, graduated: 1, risks: [] })
    const changes = await poller.check(afterBaseline)
    expect(changes.map((c) => c.type)).toEqual([
      WatchEventType.NewPool,
      WatchEventType.Graduation,
    ])
    const [afterChange] = await database.db.query.watches.findMany({
      where: (w, { eq }) => eq(w.id, watch.id),
    })
    if (!afterChange) throw new Error('no watch')
    expect(await poller.check(afterChange)).toEqual([]) // unchanged → nothing
    expect(
      (await watches.events(account.id, 10)).map((e) => e.type).sort(),
    ).toEqual([WatchEventType.Graduation, WatchEventType.NewPool].sort())

    webhooks.sent = []
    await webhooks.deliverDue()
    expect(webhooks.sent).toHaveLength(2)
    const [first] = webhooks.sent
    if (!first) throw new Error('nothing sent')
    const timestamp = first.headers[WebhookHeader.Timestamp]
    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${first.body}`)
      .digest('hex')
    expect(first.headers[WebhookHeader.Signature]).toBe(`sha256=${expected}`)
    expect(first.url).toBe('https://example.com/lab')
  })

  it('retries a failing address with growing pauses, logs every attempt, then gives up', async () => {
    const account = await newAccount()
    const { endpoint } = await webhooks.register(
      account.id,
      'https://example.com/down',
    )
    webhooks.replies = [500]
    const first = await webhooks.sendTest(account.id, endpoint.id)
    expect(first.status).toBe(DeliveryStatus.Pending)
    expect(first.attempts).toBe(1)

    // Each later attempt runs only once due; force them due and fail them all.
    for (let i = 1; i < MAX_DELIVERY_ATTEMPTS; i++) {
      webhooks.replies = [503]
      await webhooks.deliverDue(new Date(Date.now() + 365 * 86_400_000))
    }
    const [logged] = await webhooks.deliveries(account.id, 10)
    expect(logged?.attempts).toBe(MAX_DELIVERY_ATTEMPTS)
    expect(logged?.status).toBe(DeliveryStatus.Failed)
    expect(logged?.lastStatusCode).toBe(503)
    expect(logged?.attemptLog.map((a) => a.attempt)).toEqual(
      Array.from({ length: MAX_DELIVERY_ATTEMPTS }, (_, i) => i + 1),
    )
    expect(logged?.attemptLog.map((a) => a.statusCode)).toEqual([
      500,
      ...Array(MAX_DELIVERY_ATTEMPTS - 1).fill(503),
    ])
  })

  it('refuses a plain-http or private webhook address', async () => {
    const account = await newAccount()
    await expect(
      webhooks.register(account.id, 'http://hooks.example.com/x'),
    ).rejects.toThrow('https')
    await expect(
      webhooks.register(account.id, 'https://127.0.0.1/x'),
    ).rejects.toThrow('public')
  })

  it("lists, limits and removes only the account's own webhook addresses", async () => {
    const account = await newAccount()
    const other = await newAccount()
    expect(await webhooks.enqueue(account.id, null, { type: 'test' })).toBe(0)

    const urls = Array.from(
      { length: MAX_ENDPOINTS_PER_ACCOUNT },
      (_, i) => `https://example.com/hook-${i}`,
    )
    for (const hook of urls) await webhooks.register(account.id, hook)
    await expect(
      webhooks.register(account.id, 'https://example.com/one-too-many'),
    ).rejects.toThrow(WEBHOOK_TEXT.limitReached)
    const listed = await webhooks.list(account.id)
    expect(listed.map((endpoint) => endpoint.url)).toEqual(urls)
    expect(JSON.stringify(listed)).not.toContain('whsec_')

    const [first] = listed
    if (!first) throw new Error('no endpoint')
    await expect(webhooks.remove(other.id, first.id)).rejects.toThrow(
      WEBHOOK_TEXT.notFound,
    )
    await expect(webhooks.sendTest(other.id, first.id)).rejects.toThrow(
      WEBHOOK_TEXT.notFound,
    )
    await webhooks.remove(account.id, first.id)
    expect(await webhooks.list(account.id)).toHaveLength(
      MAX_ENDPOINTS_PER_ACCOUNT - 1,
    )
  })

  it('reports a fee wallet once when its unclaimed fees cross the threshold', async () => {
    const account = await newAccount()
    const wallet = address()
    await watches.add(account, {
      kind: WatchKind.FeeWallet,
      target: wallet,
      network: SolanaNetwork.Devnet,
      thresholdSol: 1,
    })
    const current = async () => {
      const [watch] = await database.db.query.watches.findMany({
        where: (w, { eq }) => eq(w.accountId, account.id),
      })
      if (!watch) throw new Error('no watch')
      return watch
    }

    chain.wallets.set(wallet, { unclaimedSol: 0.5 })
    expect(await poller.check(await current())).toEqual([])
    chain.wallets.set(wallet, { unclaimedSol: 1.2 })
    expect((await poller.check(await current())).map((c) => c.type)).toEqual([
      WatchEventType.FeesAboveThreshold,
    ])
    chain.wallets.set(wallet, { unclaimedSol: 1.5 })
    expect(await poller.check(await current())).toEqual([])
    expect(await watches.events(account.id, 10)).toHaveLength(1)
  })

  it('runs one poll under the lock: watches, then deliveries, then payment credits', async () => {
    const steps = [
      vi.spyOn(poller, 'checkWatches').mockResolvedValue(0),
      vi.spyOn(webhooks, 'deliverDue').mockResolvedValue(0),
      vi.spyOn(payments, 'creditOpen').mockResolvedValue(0),
    ]
    try {
      await poller.tick()
      const order = steps.map((step) => step.mock.invocationCallOrder[0] ?? 0)
      expect(order.every((at) => at > 0)).toBe(true)
      expect([...order].sort((a, b) => a - b)).toEqual(order)
    } finally {
      steps.forEach((step) => step.mockRestore())
    }
  })
})
