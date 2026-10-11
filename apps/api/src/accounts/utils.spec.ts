import { Keypair, PublicKey } from '@solana/web3.js'
import type {
  ParsedTransactionWithMeta,
  TokenBalance,
  TransactionError,
} from '@solana/web3.js'
import bs58 from 'bs58'
import nacl from 'tweetnacl'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountEnv, PLAN_LIMITS, PlanId, USDC_MINT } from './constants'
import type { PaymentRow } from './types'
import {
  buildSignInMessage,
  effectivePlan,
  extendedPlanEnd,
  hashToken,
  isPaidPlan,
  parseSignInMessage,
  paymentView,
  paysInFull,
  planLimits,
  readCookie,
  signInDomain,
  siteOrigin,
  solanaPayUrl,
  toKeyView,
  usdcBaseUnits,
  usdcFromBaseUnits,
  verifyWalletSignature,
} from './utils'

const wallet = nacl.sign.keyPair()
const address = bs58.encode(wallet.publicKey)
const fields = {
  domain: 'lf-aw-pod.dbc-lab.at.lime-fox.net',
  address,
  nonce: 'n0nce',
  issuedAt: '2026-10-05T10:00:00.000Z',
  expirationTime: '2026-10-05T10:05:00.000Z',
}
const sign = (message: string, secretKey = wallet.secretKey): string =>
  bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), secretKey))

describe('sign-in message (wallet-sign-in)', () => {
  it('parses back exactly the fields it was built from', () => {
    expect(parseSignInMessage(buildSignInMessage(fields))).toEqual(fields)
  })

  it('is not fooled by text that is not a sign-in message', () => {
    expect(parseSignInMessage('hello\nworld')).toBeNull()
    expect(
      parseSignInMessage(buildSignInMessage(fields).replace(/Nonce: .*/, '')),
    ).toBeNull()
  })

  it("verifies the wallet's own signature, and nothing else", () => {
    const message = buildSignInMessage(fields)
    expect(verifyWalletSignature(message, sign(message), address)).toBe(true)
    expect(verifyWalletSignature(`${message} `, sign(message), address)).toBe(
      false,
    )
    const other = nacl.sign.keyPair()
    expect(
      verifyWalletSignature(message, sign(message, other.secretKey), address),
    ).toBe(false)
    expect(verifyWalletSignature(message, 'not-base58!', address)).toBe(false)
  })
})

describe('session cookie', () => {
  it('reads one cookie out of a header with several', () => {
    expect(readCookie('a=1; lab_session=tok; b=2', 'lab_session')).toBe('tok')
    expect(readCookie('a=1', 'lab_session')).toBeUndefined()
    expect(readCookie(undefined, 'lab_session')).toBeUndefined()
  })
})

describe('plans (service-plans, usdc-plan-payment)', () => {
  const now = new Date('2026-10-05T00:00:00Z')
  const later = new Date('2026-10-20T00:00:00Z')
  const earlier = new Date('2026-09-20T00:00:00Z')

  it('is pro only while a paid pro period is running; lapsed means free', () => {
    expect(
      effectivePlan({ paidPlan: PlanId.Pro, planEndsAt: later }, now),
    ).toBe(PlanId.Pro)
    expect(
      effectivePlan({ paidPlan: PlanId.Pro, planEndsAt: earlier }, now),
    ).toBe(PlanId.Free)
    expect(effectivePlan({ paidPlan: null, planEndsAt: null }, now)).toBe(
      PlanId.Free,
    )
  })

  it('extends from the current end while active, otherwise from now', () => {
    expect(extendedPlanEnd(later, now, 30).toISOString()).toBe(
      '2026-11-19T00:00:00.000Z',
    )
    expect(extendedPlanEnd(earlier, now, 30).toISOString()).toBe(
      '2026-11-04T00:00:00.000Z',
    )
    expect(extendedPlanEnd(null, now, 30).toISOString()).toBe(
      '2026-11-04T00:00:00.000Z',
    )
  })

  it('prices in USDC base units and names the transfer as Solana Pay expects', () => {
    expect(usdcBaseUnits(49)).toBe(49_000_000n)
    const url = new URL(
      solanaPayUrl({
        recipient: address,
        amountUsdc: 49,
        mint: 'MINT',
        reference: 'REF',
        label: 'DBC Config Lab',
        message: 'pro plan',
      }),
    )
    expect(url.protocol).toBe('solana:')
    expect(url.pathname).toBe(address)
    expect(url.searchParams.get('amount')).toBe('49')
    expect(url.searchParams.get('spl-token')).toBe('MINT')
    expect(url.searchParams.get('reference')).toBe('REF')
  })

  it('gives the limits of the plan the account is on now', () => {
    expect(planLimits({ paidPlan: PlanId.Pro, planEndsAt: later }, now)).toBe(
      PLAN_LIMITS[PlanId.Pro],
    )
    expect(planLimits({ paidPlan: PlanId.Pro, planEndsAt: earlier }, now)).toBe(
      PLAN_LIMITS[PlanId.Free],
    )
  })

  it('converts base units back to whole USDC', () => {
    expect(usdcFromBaseUnits(49_000_000n)).toBe(49)
    expect(usdcFromBaseUnits(usdcBaseUnits(0.5))).toBe(0.5)
  })

  it('knows which plans are paid', () => {
    expect(isPaidPlan(PlanId.Pro)).toBe(true)
    expect(isPaidPlan(PlanId.Free)).toBe(false)
    expect(isPaidPlan('enterprise')).toBe(false)
  })
})

describe('tokens', () => {
  it('stores a token as a stable sha-256 hash that never contains it', () => {
    const hash = hashToken('secret-token')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toBe(hashToken('secret-token'))
    expect(hash).not.toBe(hashToken('other-token'))
  })

  it('shows a key by its label and prefix only', () => {
    const createdAt = new Date('2026-10-05T10:00:00Z')
    const fields = {
      id: 'key-1',
      externalRef: 'my agent',
      keyPrefix: 'agt_abcd...',
      createdAt,
    }
    expect(toKeyView({ ...fields, lastUsedAt: null })).toEqual({
      id: 'key-1',
      label: 'my agent',
      prefix: 'agt_abcd...',
      createdAt: '2026-10-05T10:00:00.000Z',
      lastUsedAt: null,
    })
    expect(toKeyView({ ...fields, lastUsedAt: createdAt }).lastUsedAt).toBe(
      '2026-10-05T10:00:00.000Z',
    )
  })
})

describe('site origin (hosting-portability)', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('uses the configured origin, and its host as the sign-in domain', () => {
    vi.stubEnv(AccountEnv.SiteOrigin, 'https://lab.example/some/path')
    expect(siteOrigin()).toBe('https://lab.example')
    expect(signInDomain()).toBe('lab.example')
  })
})

describe('payment requests (usdc-plan-payment)', () => {
  const recipient = Keypair.generate().publicKey.toBase58()
  const reference = Keypair.generate().publicKey.toBase58()
  const mint = USDC_MINT.devnet
  const payment: PaymentRow = {
    reference,
    accountId: 'account-1',
    plan: PlanId.Pro,
    amount: 49_000_000n,
    recipient,
    network: 'devnet',
    signature: null,
    createdAt: new Date('2026-10-05T00:00:00Z'),
    creditedAt: null,
  }

  it('shows a request with its amount, Solana Pay link and credit state', () => {
    const view = paymentView(payment, { planEndsAt: null })
    expect(view).toMatchObject({
      reference,
      plan: PlanId.Pro,
      amountUsdc: 49,
      network: 'devnet',
      credited: false,
      planEndsAt: null,
    })
    const url = new URL(view.url)
    expect(url.searchParams.get('spl-token')).toBe(mint)
    expect(url.searchParams.get('message')).toBe('DBC Config Lab — pro plan')

    const ends = new Date('2026-11-04T00:00:00Z')
    const credited = paymentView(
      { ...payment, creditedAt: new Date() },
      { planEndsAt: ends },
    )
    expect(credited.credited).toBe(true)
    expect(credited.planEndsAt).toBe(ends.toISOString())
  })

  const balance = (units: bigint, owner = recipient): TokenBalance => ({
    accountIndex: 1,
    mint,
    owner,
    uiTokenAmount: {
      amount: units.toString(),
      decimals: 6,
      uiAmount: Number(units) / 1e6,
    },
  })
  const transfer = (
    received: bigint,
    keys: string[] = [reference],
    err: TransactionError | null = null,
  ): ParsedTransactionWithMeta => ({
    slot: 1,
    blockTime: null,
    meta: {
      err,
      fee: 5000,
      preBalances: [],
      postBalances: [],
      preTokenBalances: [balance(1_000_000n)],
      postTokenBalances: [balance(1_000_000n + received)],
    },
    transaction: {
      signatures: ['sig'],
      message: {
        accountKeys: keys.map((key) => ({
          pubkey: new PublicKey(key),
          signer: false,
          writable: false,
        })),
        instructions: [],
        recentBlockhash: '',
      },
    },
  })

  it('accepts a transfer of at least the full amount that carries the reference', () => {
    expect(paysInFull(transfer(49_000_000n), payment, mint)).toBe(true)
    expect(paysInFull(transfer(50_000_000n), payment, mint)).toBe(true)
  })

  it('refuses a short, unreferenced, failed or other-mint transfer', () => {
    expect(paysInFull(transfer(48_999_999n), payment, mint)).toBe(false)
    const unrelated = Keypair.generate().publicKey.toBase58()
    expect(paysInFull(transfer(49_000_000n, [unrelated]), payment, mint)).toBe(
      false,
    )
    const failed = transfer(49_000_000n, [reference], {
      InstructionError: [0, 'Custom'],
    })
    expect(paysInFull(failed, payment, mint)).toBe(false)
    const otherMint = USDC_MINT['mainnet-beta']
    expect(paysInFull(transfer(49_000_000n), payment, otherMint)).toBe(false)
  })
})
