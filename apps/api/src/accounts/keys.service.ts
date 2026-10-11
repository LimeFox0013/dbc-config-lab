import { Inject, Injectable } from '@nestjs/common'
import { AgenticAccountService } from '@lf/agentic-account'
import { and, desc, eq } from 'drizzle-orm'
import { agenticAccounts, DRIZZLE_DB } from '../db'
import type { DrizzleDb } from '../db'
import {
  KEY_EXTERNAL_SYSTEM,
  MCP_CALLER_ROLE,
  MCP_TOOL_ACCESS,
} from './constants'
import type { ApiKeyView, CreatedApiKey } from './types'
import { toKeyView } from './utils'

/**
 * `api-keys`: an account's keys, on `@lf/agentic-account` — shown once at
 * creation, stored as a hash, revocable. The key's label is its external ref.
 */
@Injectable()
export class KeysService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly agentic: AgenticAccountService,
  ) {}

  /** A new key for the account: the full key, returned this once only. */
  async create(accountId: string, label: string): Promise<CreatedApiKey> {
    const role = await this.agentic.getOrCreateRole(MCP_CALLER_ROLE, [
      MCP_TOOL_ACCESS,
    ])
    const minted = await this.agentic.mintAccount(
      accountId,
      role.id,
      KEY_EXTERNAL_SYSTEM,
      label,
    )
    return {
      key: minted.rawKey,
      view: toKeyView({ ...minted, lastUsedAt: null }),
    }
  }

  /** The account's live keys, newest first. */
  async list(accountId: string): Promise<ApiKeyView[]> {
    const rows = await this.db
      .select()
      .from(agenticAccounts)
      .where(
        and(
          eq(agenticAccounts.tenantId, accountId),
          eq(agenticAccounts.isActive, true),
        ),
      )
      .orderBy(desc(agenticAccounts.createdAt))
    return rows.map(toKeyView)
  }

  /** Revokes one of the account's own keys; false when it has no such live key. */
  async revoke(accountId: string, keyId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: agenticAccounts.id })
      .from(agenticAccounts)
      .where(
        and(
          eq(agenticAccounts.id, keyId),
          eq(agenticAccounts.tenantId, accountId),
          eq(agenticAccounts.isActive, true),
        ),
      )
    if (!row) return false
    await this.agentic.revokeAccount(row.id)
    return true
  }

  /** The account a presented key belongs to, or null for an unknown or revoked key. */
  async accountForKey(rawKey: string): Promise<string | null> {
    const key = await this.agentic.authenticate(rawKey)
    return key?.permissions.includes(MCP_TOOL_ACCESS) ? key.tenantId : null
  }
}
