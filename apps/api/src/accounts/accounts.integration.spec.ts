import { AgenticAccountService } from '@lf/agentic-account'
import { createDrizzleAgenticAccountRepository } from '@lf/agentic-account-drizzle'
import { Keypair, PublicKey } from '@solana/web3.js'
import type {
  ConfirmedSignatureInfo,
  ParsedTransactionWithMeta,
} from '@solana/web3.js'
import bs58 from 'bs58'
import nacl from 'tweetnacl'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DatabaseService } from '../db/database.service'
import { agenticAccounts, agenticRoles } from '../db'
import { UsageService } from '../usage'
import { AccountsService } from './accounts.service'
import { AuthService } from './auth.service'
import {
  AccountEnv,
  OPEN_PAYMENT_WINDOW_MS,
  PlanId,
  USDC_MINT,
} from './constants'
import { KeysService } from './keys.service'
import { PaymentsService } from './payments.service'
import type { TransferReader } from './types'
import { buildSignInMessage } from './utils'

/**
 * Against a real Postgres (migrations included), so the uniqueness and
 * once-only rules are the database's, not a mock's. Runs when
 * TEST_DATABASE_URL names a scratch database; skipped otherwise.
 */
const url = process.env['TEST_DATABASE_URL']
const DOMAIN = 'lab.example'

describe.skipIf(!url)('accounts against Postgres', () => {
  let database: DatabaseService
  let auth: AuthService
  let keys: KeysService
  let accounts: AccountsService
  let usage: UsageService
  let payments: PaymentsService
  const recipient = Keypair.generate().publicKey.toBase58()
  let chain: {
    signatures: ConfirmedSignatureInfo[]
    transaction: ParsedTransactionWithMeta | null
  }

  beforeAll(async () => {
    process.env['DATABASE_URL'] = url
    process.env['MIGRATIONS_DIR'] = resolve(__dirname, '../../drizzle')
    process.env['CALLER_HASH_KEY'] = 'test-hash-key'
    process.env[AccountEnv.PayRecipient] = recipient
    process.env[AccountEnv.PayNetwork] = 'devnet'
    database = new DatabaseService()
    await database.onModuleInit()
    const db = database.db
    usage = new UsageService(db)
    accounts = new AccountsService(db, usage)
    auth = new AuthService(db, accounts)
    keys = new KeysService(
      db,
      new AgenticAccountService(
        createDrizzleAgenticAccountRepository(db, {
          agenticRoles,
          agenticAccounts,
        }),
      ),
    )
    chain = { signatures: [], transaction: null }
    const fakeChain: TransferReader = {
      getSignaturesForAddress: async () => chain.signatures,
      getParsedTransaction: async () => chain.transaction,
    }
    payments = new (class extends PaymentsService {
      protected override connection(): TransferReader {
        return fakeChain
      }
    })(db)
  })
  afterAll(async () => {
    await database?.onModuleDestroy()
  })

  const wallet = () => {
    const pair = nacl.sign.keyPair()
    return { pair, address: bs58.encode(pair.publicKey) }
  }
  const signed = (message: string, secretKey: Uint8Array) =>
    bs58.encode(
      nacl.sign.detached(new TextEncoder().encode(message), secretKey),
    )

  const signIn = async () => {
    const { pair, address } = wallet()
    const { message } = await auth.challenge(address, DOMAIN)
    const session = await auth.signIn(
      message,
      signed(message, pair.secretKey),
      DOMAIN,
    )
    if (!session) throw new Error('sign-in failed')
    return { ...session, address, pair }
  }

  it('signs a wallet in once per challenge and keeps one account per wallet', async () => {
    const { pair, address } = wallet()
    const { message } = await auth.challenge(address, DOMAIN)
    const signature = signed(message, pair.secretKey)

    const first = await auth.signIn(message, signature, DOMAIN)
    expect(first?.account.walletAddress).toBe(address)
    // The challenge is burned: the same signed message cannot sign in again.
    expect(await auth.signIn(message, signature, DOMAIN)).toBeNull()

    const { message: again } = await auth.challenge(address, DOMAIN)
    const second = await auth.signIn(
      again,
      signed(again, pair.secretKey),
      DOMAIN,
    )
    expect(second?.account.id).toBe(first?.account.id)
  })

  it('refuses another domain, an expired challenge and a forged challenge', async () => {
    const { pair, address } = wallet()
    const { message } = await auth.challenge(address, DOMAIN)
    expect(
      await auth.signIn(
        message,
        signed(message, pair.secretKey),
        'evil.example',
      ),
    ).toBeNull()

    const { message: stale } = await auth.challenge(
      address,
      DOMAIN,
      new Date(Date.now() - 3_600_000),
    )
    expect(
      await auth.signIn(stale, signed(stale, pair.secretKey), DOMAIN),
    ).toBeNull()

    const forged = buildSignInMessage({
      domain: DOMAIN,
      address,
      nonce: 'never-issued',
      issuedAt: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(
      await auth.signIn(forged, signed(forged, pair.secretKey), DOMAIN),
    ).toBeNull()
  })

  it("adds up each caller's calls per UTC day and shows today's on the account", async () => {
    const { account } = await signIn()
    const caller = usage.callerForAccount(account.id)
    const today = new Date()
    const yesterday = new Date(today.getTime() - 86_400_000)

    expect(await usage.record(caller, 2, today)).toBe(2)
    expect(await usage.record(caller, 3, today)).toBe(5)
    expect(await usage.record(caller, 1, yesterday)).toBe(1)
    expect(await usage.today(caller, today)).toBe(5)
    expect(await usage.today(usage.callerForAccount('nobody'), today)).toBe(0)
    expect((await accounts.view(account, today)).callsToday).toBe(5)
  })

  it('keeps a session until sign-out', async () => {
    const { token, account } = await signIn()
    expect((await auth.accountForSession(token))?.id).toBe(account.id)
    await auth.signOut(token)
    expect(await auth.accountForSession(token)).toBeUndefined()
  })

  it('shows a key once, lists only its prefix, and lets only its own account revoke it', async () => {
    const owner = await signIn()
    const stranger = await signIn()
    const { key, view } = await keys.create(owner.account.id, 'my agent')

    expect(key.startsWith(view.prefix.replace(/\.\.\.$/, ''))).toBe(true)
    expect(await keys.accountForKey(key)).toBe(owner.account.id)
    const listed = await keys.list(owner.account.id)
    expect(listed.map((k) => k.label)).toEqual(['my agent'])
    expect(JSON.stringify(listed)).not.toContain(key)

    expect(await keys.revoke(stranger.account.id, view.id)).toBe(false)
    expect(await keys.accountForKey(key)).toBe(owner.account.id)
    expect(await keys.revoke(owner.account.id, view.id)).toBe(true)
    expect(await keys.accountForKey(key)).toBeNull()
    expect(await keys.list(owner.account.id)).toEqual([])
  })

  const signatureInfo = (signature: string): ConfirmedSignatureInfo => ({
    signature,
    slot: 1,
    err: null,
    memo: null,
  })
  const usdcBalance = (units: bigint) => ({
    accountIndex: 1,
    mint: USDC_MINT.devnet,
    owner: recipient,
    uiTokenAmount: {
      amount: units.toString(),
      decimals: 6,
      uiAmount: Number(units) / 1e6,
    },
  })
  const transferTo = (
    reference: string,
    units: bigint,
  ): ParsedTransactionWithMeta => ({
    slot: 1,
    blockTime: null,
    meta: {
      err: null,
      fee: 5000,
      preBalances: [],
      postBalances: [],
      preTokenBalances: [usdcBalance(0n)],
      postTokenBalances: [usdcBalance(units)],
    },
    transaction: {
      signatures: ['sig'],
      message: {
        accountKeys: [
          { pubkey: new PublicKey(reference), signer: false, writable: false },
        ],
        instructions: [],
        recentBlockhash: '',
      },
    },
  })

  it('extends the plan once per finalized transfer of the full amount', async () => {
    const { account } = await signIn()
    const request = await payments.request(account, PlanId.Pro)
    expect(request.amountUsdc).toBe(49)
    expect(request.url).toContain(`reference=${request.reference}`)

    // Not paid yet, then paid short: no credit.
    expect((await payments.check(account, request.reference)).credited).toBe(
      false,
    )
    chain.signatures = [signatureInfo('short-sig')]
    chain.transaction = transferTo(request.reference, 48_000_000n)
    expect((await payments.check(account, request.reference)).credited).toBe(
      false,
    )

    chain.signatures = [signatureInfo(`full-sig-${request.reference}`)]
    chain.transaction = transferTo(request.reference, 49_000_000n)
    const credited = await payments.check(account, request.reference)
    expect(credited.credited).toBe(true)
    const paid = await accounts.get(account.id)
    expect(paid?.paidPlan).toBe(PlanId.Pro)
    const endsAt = paid?.planEndsAt?.getTime() ?? 0
    expect(endsAt - Date.now()).toBeGreaterThan(29 * 86_400_000)

    // Checking again never extends again.
    await payments.check(account, request.reference)
    expect((await accounts.get(account.id))?.planEndsAt?.getTime()).toBe(endsAt)
    expect(
      (await accounts.view((await accounts.get(account.id)) ?? account)).plan,
    ).toBe(PlanId.Pro)
  })

  it('credits a paid request in the background when the client never checks it', async () => {
    const { account } = await signIn()
    const request = await payments.request(account, PlanId.Pro)
    chain.signatures = [signatureInfo(`background-sig-${request.reference}`)]
    chain.transaction = transferTo(request.reference, 49_000_000n)

    expect(await payments.creditOpen()).toBe(1)
    expect((await accounts.get(account.id))?.paidPlan).toBe(PlanId.Pro)
    expect(await payments.creditOpen()).toBe(0) // credited once, no longer open

    // A request older than the window is no longer checked. The cutoff is taken after
    // the request exists, with a second's margin, so database latency cannot put it inside.
    const stale = await payments.request(account, PlanId.Pro)
    chain.signatures = [signatureInfo(`stale-sig-${stale.reference}`)]
    chain.transaction = transferTo(stale.reference, 49_000_000n)
    const later = new Date(Date.now() + OPEN_PAYMENT_WINDOW_MS + 1_000)
    expect(await payments.creditOpen(later)).toBe(0)
  })
})
