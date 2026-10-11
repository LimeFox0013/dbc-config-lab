import { describe, expect, it, vi } from 'vitest'
import bs58 from 'bs58'
import { Keypair, PublicKey } from '@solana/web3.js'
import type { SolanaSignMessageFeature } from '@solana/wallet-standard-features'
import type { WalletAccount } from '@wallet-standard/base'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  SolanaNetwork,
  TOKEN_PROGRAM_ID,
} from '../../core/shared'
import type { ConnectedWallet, DeployWallet } from '../wallet'
import {
  accountApiUrl,
  associatedTokenAddress,
  createAccountClient,
  DEFAULT_ACCOUNT_API_URL,
  formatUtcTime,
  PlanId,
  pollUntilCredited,
  SignInStop,
  signInWithWallet,
  usdcTransferInstruction,
  USDC_MINT,
  useOneTimeSecret,
  WatchKind,
} from '.'
import type { AccountView, ApiResult, PaymentRequestView } from '.'
import type { FetchLike } from './types'
import { NO_STATE_TEXT, USDC_DECIMALS, WatchEventType } from './constants'
import {
  errorMessageOf,
  isWatchEventType,
  stateText,
  usdcBaseUnits,
} from './utils'
import { canSignMessage } from './signIn'
import { QUOTE_TOKENS, QuoteToken } from '../../core/quote-token'

const BASE = 'https://api.example'
const WALLET = '11111111111111111111111111111112'

const ACCOUNT: AccountView = {
  walletAddress: WALLET,
  plan: PlanId.Free,
  planEndsAt: null,
  callsToday: 12,
  dailyCalls: 200,
  watches: 1,
}

const json = (status: number, body: unknown): Response =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** A fetch that answers from `answer` and records every call. */
const mockFetch = (answer: (url: string, init: RequestInit) => Response) =>
  vi.fn<FetchLike>(async (url, init) => answer(url, init))

describe('accountApiUrl', () => {
  it('uses the configured address, without a trailing slash', () => {
    expect(accountApiUrl('https://lab.example/api/')).toBe(
      'https://lab.example/api',
    )
  })

  it('falls back to the default when nothing is configured', () => {
    expect(accountApiUrl(undefined)).toBe(DEFAULT_ACCOUNT_API_URL)
    expect(accountApiUrl('  ')).toBe(DEFAULT_ACCOUNT_API_URL)
  })
})

describe('createAccountClient', () => {
  it('sends the session cookie and a JSON body, and returns the checked answer', async () => {
    const fetchImpl = mockFetch(() =>
      json(201, {
        key: 'lab_full',
        view: {
          id: 'k1',
          label: 'ci',
          prefix: 'lab_fu',
          createdAt: 'x',
          lastUsedAt: null,
        },
      }),
    )
    const result = await createAccountClient(BASE, fetchImpl).createKey('ci')
    expect(result).toEqual({
      ok: true,
      value: {
        key: 'lab_full',
        view: {
          id: 'k1',
          label: 'ci',
          prefix: 'lab_fu',
          createdAt: 'x',
          lastUsedAt: null,
        },
      },
    })
    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(url).toBe(`${BASE}/account/keys`)
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'ci' }),
    })
  })

  it('reads a GET without a body', async () => {
    const fetchImpl = mockFetch(() => json(200, ACCOUNT))
    expect(await createAccountClient(BASE, fetchImpl).account()).toEqual({
      ok: true,
      value: ACCOUNT,
    })
    expect(fetchImpl.mock.calls[0]?.[1]).toEqual({
      method: 'GET',
      credentials: 'include',
    })
  })

  it('passes the service’s refusal through in its own words', async () => {
    const message =
      "This account's plan allows 3 watches; delete or pause one first, or move to a paid plan."
    const fetchImpl = mockFetch(() => json(400, { statusCode: 400, message }))
    const result = await createAccountClient(BASE, fetchImpl).addWatch({
      kind: WatchKind.Config,
      target: WALLET,
      network: SolanaNetwork.Mainnet,
    })
    expect(result).toEqual({ ok: false, failure: { status: 400, message } })
  })

  it('reports a signed-out session as 401', async () => {
    const fetchImpl = mockFetch(() =>
      json(401, {
        statusCode: 401,
        message: 'Sign in with your wallet first.',
      }),
    )
    expect(await createAccountClient(BASE, fetchImpl).account()).toEqual({
      ok: false,
      failure: { status: 401, message: 'Sign in with your wallet first.' },
    })
  })

  it('accepts 204 answers and encodes ids into the path', async () => {
    const fetchImpl = mockFetch(() => json(204, null))
    expect(await createAccountClient(BASE, fetchImpl).revokeKey('a/b')).toEqual(
      { ok: true, value: null },
    )
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/account/keys/a%2Fb`)
  })

  it('posts a webhook test to the address’s own route', async () => {
    const fetchImpl = mockFetch(() => json(500, 'not json'))
    await createAccountClient(BASE, fetchImpl).testWebhook('w1')
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      `${BASE}/account/webhooks/w1/test`,
    )
  })

  it('never throws: an unreachable service or an unexpected answer has no message', async () => {
    const unreachable = vi.fn<FetchLike>(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await createAccountClient(BASE, unreachable).account()).toEqual({
      ok: false,
      failure: { status: 0, message: null },
    })
    const malformed = mockFetch(() => json(200, { walletAddress: WALLET }))
    expect(await createAccountClient(BASE, malformed).account()).toEqual({
      ok: false,
      failure: { status: 200, message: null },
    })
  })
})

const account: WalletAccount = {
  address: WALLET,
  publicKey: new PublicKey(WALLET).toBytes(),
  chains: ['solana:devnet'],
  features: ['solana:signMessage'],
}

const connectedWith = (
  features: DeployWallet['features'] & Partial<SolanaSignMessageFeature>,
): ConnectedWallet => ({
  wallet: {
    version: '1.0.0',
    name: 'Test',
    icon: 'data:image/svg+xml;base64,',
    chains: ['solana:devnet'],
    accounts: [account],
    features,
  },
  account,
  owner: new PublicKey(WALLET),
})

const deployFeatures = {
  'standard:connect': {
    version: '1.0.0',
    connect: async () => ({ accounts: [account] }),
  },
  'solana:signAndSendTransaction': {
    version: '1.0.0',
    supportedTransactionVersions: ['legacy'],
    signAndSendTransaction: async () => [],
  },
} as const satisfies DeployWallet['features']

describe('signInWithWallet', () => {
  it('signs the service’s exact challenge and sends the signature as base58', async () => {
    const signature = new Uint8Array(64).fill(3)
    const signMessage = vi.fn(async () => [
      { signedMessage: new Uint8Array(), signature },
    ])
    const fetchImpl = mockFetch((url) =>
      url.endsWith('/auth/challenge')
        ? json(201, { message: 'lab wants you to sign in', nonce: 'n' })
        : json(201, ACCOUNT),
    )
    const result = await signInWithWallet(
      createAccountClient(BASE, fetchImpl),
      connectedWith({
        ...deployFeatures,
        'solana:signMessage': { version: '1.0.0', signMessage },
      }),
    )
    expect(result).toEqual({ ok: true, value: ACCOUNT })
    expect(signMessage).toHaveBeenCalledWith({
      account,
      message: new TextEncoder().encode('lab wants you to sign in'),
    })
    expect(fetchImpl.mock.calls[0]?.[1].body).toBe(
      JSON.stringify({ address: WALLET }),
    )
    expect(fetchImpl.mock.calls[1]?.[1].body).toBe(
      JSON.stringify({
        message: 'lab wants you to sign in',
        signature: bs58.encode(signature),
      }),
    )
  })

  it('stops before asking the service when the wallet cannot sign messages', async () => {
    const fetchImpl = mockFetch(() => json(201, ACCOUNT))
    const result = await signInWithWallet(
      createAccountClient(BASE, fetchImpl),
      connectedWith(deployFeatures),
    )
    expect(result).toEqual({
      ok: false,
      stop: SignInStop.NoSignMessage,
      detail: null,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports a wallet that declines, and never sends a session request', async () => {
    const fetchImpl = mockFetch(() => json(201, { message: 'm', nonce: 'n' }))
    const signMessage = vi.fn(async () => {
      throw new Error('User rejected the request')
    })
    const result = await signInWithWallet(
      createAccountClient(BASE, fetchImpl),
      connectedWith({
        ...deployFeatures,
        'solana:signMessage': { version: '1.0.0', signMessage },
      }),
    )
    expect(result).toEqual({
      ok: false,
      stop: SignInStop.WalletFailed,
      detail: 'User rejected the request',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('usdcTransferInstruction', () => {
  const payer = new PublicKey(WALLET)
  const recipient = Keypair.generate().publicKey
  const reference = Keypair.generate().publicKey
  const instruction = usdcTransferInstruction(
    {
      recipient: recipient.toBase58(),
      amountUsdc: 49,
      reference: reference.toBase58(),
      network: SolanaNetwork.Devnet,
    },
    payer,
  )

  it('derives associated token accounts as the ATA program does', () => {
    expect(
      associatedTokenAddress(
        payer,
        new PublicKey(USDC_MINT[SolanaNetwork.Devnet]),
      ).toBase58(),
    ).toBe('4tRapEGgJZKuGoeeMRrpHsxAEuvo5YnDCzTXykqDhrK9')
    expect(ASSOCIATED_TOKEN_PROGRAM_ID).toBe(
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
    )
  })

  it('is a TransferChecked of the amount in USDC base units with 6 decimals', () => {
    expect(instruction.programId.toBase58()).toBe(TOKEN_PROGRAM_ID)
    // tag 12, 49_000_000 as u64 little-endian, decimals 6
    expect(instruction.data.toString('hex')).toBe('0c40aeeb020000000006')
  })

  it('moves USDC between the two wallets’ token accounts, signed by the payer, and carries the reference', () => {
    const mint = new PublicKey(USDC_MINT[SolanaNetwork.Devnet])
    expect(
      instruction.keys.map((key) => [
        key.pubkey.toBase58(),
        key.isSigner,
        key.isWritable,
      ]),
    ).toEqual([
      [associatedTokenAddress(payer, mint).toBase58(), false, true],
      [mint.toBase58(), false, false],
      [associatedTokenAddress(recipient, mint).toBase58(), false, true],
      [WALLET, true, false],
      [reference.toBase58(), false, false],
    ])
  })
})

describe('pollUntilCredited', () => {
  const payment = (credited: boolean): ApiResult<PaymentRequestView> => ({
    ok: true,
    value: {
      reference: 'r',
      plan: PlanId.Pro,
      amountUsdc: 49,
      recipient: WALLET,
      network: SolanaNetwork.Devnet,
      url: 'solana:x',
      credited,
      planEndsAt: credited ? '2026-11-04T00:00:00.000Z' : null,
    },
  })

  it('checks again until the service reports the payment credited', async () => {
    const check = vi
      .fn<() => Promise<ApiResult<PaymentRequestView>>>()
      .mockResolvedValueOnce(payment(false))
      .mockResolvedValueOnce(payment(true))
    expect(await pollUntilCredited(check, 5, 0)).toEqual(payment(true))
    expect(check).toHaveBeenCalledTimes(2)
  })

  it('stops after the given number of checks', async () => {
    const check = vi.fn(async () => payment(false))
    expect(await pollUntilCredited(check, 3, 0)).toEqual(payment(false))
    expect(check).toHaveBeenCalledTimes(3)
  })

  it('stops at a refusal', async () => {
    const refusal: ApiResult<PaymentRequestView> = {
      ok: false,
      failure: {
        status: 404,
        message: 'No such payment request on this account.',
      },
    }
    const check = vi.fn(async () => refusal)
    expect(await pollUntilCredited(check, 3, 0)).toEqual(refusal)
    expect(check).toHaveBeenCalledTimes(1)
  })
})

describe('useOneTimeSecret', () => {
  it('holds a disclosed secret until dismissed, and a new page state starts without it', () => {
    const shown = useOneTimeSecret()
    expect(shown.secret.value).toBeNull()
    shown.reveal('lab_secret')
    expect(shown.secret.value).toBe('lab_secret')
    shown.dismiss()
    expect(shown.secret.value).toBeNull()
    expect(useOneTimeSecret().secret.value).toBeNull()
  })
})

describe('formatUtcTime', () => {
  it('shows a service timestamp to the minute in UTC', () => {
    expect(formatUtcTime('2026-11-04T09:30:12.000Z')).toBe(
      '2026-11-04 09:30 UTC',
    )
    expect(formatUtcTime('not a date')).toBe('not a date')
  })
})

describe('account helpers', () => {
  it('pays in the lab’s own USDC: same mints, same decimals', () => {
    expect(USDC_MINT).toEqual(QUOTE_TOKENS[QuoteToken.Usdc].mints)
    expect(USDC_DECIMALS).toBe(QUOTE_TOKENS[QuoteToken.Usdc].decimals)
  })

  it('converts whole USDC to base units, rounding off float noise', () => {
    expect(usdcBaseUnits(9.99)).toBe(9_990_000n)
    expect(usdcBaseUnits(0.1 + 0.2)).toBe(300_000n)
  })

  it('reads a Nest error body’s message, and nothing else', () => {
    expect(errorMessageOf({ message: 'No plan', statusCode: 400 })).toBe(
      'No plan',
    )
    expect(errorMessageOf({ message: ['a', 'b'] })).toBeNull()
    expect(errorMessageOf('text')).toBeNull()
  })

  it('knows the event types it has words for', () => {
    expect(isWatchEventType(WatchEventType.Graduation)).toBe(true)
    expect(isWatchEventType('price-moon')).toBe(false)
  })

  it('shows an event state as compact JSON, and a missing one as a dash', () => {
    expect(stateText({ pools: 2 })).toBe('{"pools":2}')
    expect(stateText(null)).toBe(NO_STATE_TEXT)
    expect(stateText(undefined)).toBe(NO_STATE_TEXT)
  })

  it('tells a wallet that can sign a plain message', () => {
    const signing = connectedWith({
      ...deployFeatures,
      'solana:signMessage': { version: '1.0.0', signMessage: async () => [] },
    })
    expect(canSignMessage(signing.wallet)).toBe(true)
    expect(canSignMessage(connectedWith(deployFeatures).wallet)).toBe(false)
  })
})
