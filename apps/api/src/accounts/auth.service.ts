import { Inject, Injectable } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import bs58 from 'bs58'
import { and, eq, gt, lt } from 'drizzle-orm'
import { DRIZZLE_DB, sessions, signInChallenges } from '../db'
import type { DrizzleDb } from '../db'
import { AccountsService } from './accounts.service'
import {
  CHALLENGE_TTL_MS,
  NONCE_BYTES,
  SESSION_TTL_MS,
  TOKEN_BYTES,
} from './constants'
import type { Account, SignedInSession, SignInChallenge } from './types'
import {
  buildSignInMessage,
  hashToken,
  parseSignInMessage,
  verifyWalletSignature,
} from './utils'

/**
 * `wallet-sign-in`: a one-time challenge, a wallet signature over it, and a
 * session held as a hash of the cookie's token.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly accounts: AccountsService,
  ) {}

  /** A fresh challenge for `address`, as the exact message its wallet signs. */
  async challenge(
    address: string,
    domain: string,
    now = new Date(),
  ): Promise<SignInChallenge> {
    const nonce = bs58.encode(randomBytes(NONCE_BYTES))
    const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS)
    // Expired challenges go with every new one, so the table never grows unbounded.
    await this.db
      .delete(signInChallenges)
      .where(lt(signInChallenges.expiresAt, now))
    await this.db
      .insert(signInChallenges)
      .values({ nonce, walletAddress: address, expiresAt })
    return {
      nonce,
      message: buildSignInMessage({
        domain,
        address,
        nonce,
        issuedAt: now.toISOString(),
        expirationTime: expiresAt.toISOString(),
      }),
    }
  }

  /**
   * Signs in with a signed challenge: the signature must verify against the
   * address, the message name this service, and its challenge be unused and
   * unexpired — the challenge is burned either way. Returns the session token
   * (for the cookie only) and the account, or null when anything fails.
   */
  async signIn(
    message: string,
    signature: string,
    domain: string,
    now = new Date(),
  ): Promise<SignedInSession | null> {
    const fields = parseSignInMessage(message)
    if (!fields) return null
    const [challenge] = await this.db
      .delete(signInChallenges)
      .where(eq(signInChallenges.nonce, fields.nonce))
      .returning()
    const valid =
      challenge !== undefined &&
      challenge.walletAddress === fields.address &&
      challenge.expiresAt > now &&
      new Date(fields.expirationTime) > now &&
      fields.domain === domain &&
      verifyWalletSignature(message, signature, fields.address)
    if (!valid) return null

    const account = await this.accounts.findOrCreate(fields.address)
    const token = bs58.encode(randomBytes(TOKEN_BYTES))
    await this.db.insert(sessions).values({
      tokenHash: hashToken(token),
      accountId: account.id,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    })
    return { token, account }
  }

  /** The session's account, while the session is live. */
  async accountForSession(
    token: string,
    now = new Date(),
  ): Promise<Account | undefined> {
    const [session] = await this.db
      .select({ accountId: sessions.accountId })
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenHash, hashToken(token)),
          gt(sessions.expiresAt, now),
        ),
      )
    return session ? this.accounts.get(session.accountId) : undefined
  }

  async signOut(token: string): Promise<void> {
    await this.db
      .delete(sessions)
      .where(eq(sessions.tokenHash, hashToken(token)))
  }
}
