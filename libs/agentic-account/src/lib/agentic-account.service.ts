import { Inject, Injectable, Logger } from '@nestjs/common'
import { AGENTIC_ACCOUNT_REPOSITORY_TOKEN } from './constants.js'
import type { IAgenticAccountRepository } from './agentic-account.ports.js'
import type {
  AuthenticatedAgenticAccount,
  MintedAgenticAccount,
} from './types.js'
import {
  generateAgenticKey,
  hashAgenticKey,
  toKeyDisplayPrefix,
} from './utils.js'

@Injectable()
export class AgenticAccountService {
  private readonly logger = new Logger(AgenticAccountService.name)

  constructor(
    @Inject(AGENTIC_ACCOUNT_REPOSITORY_TOKEN)
    private readonly repository: IAgenticAccountRepository,
  ) {}

  /**
   * Finds a role by name, or creates it with the given starting permissions.
   * Never mutates an already-existing role's permissions — use
   * `grantPermission` to grow one.
   */
  async getOrCreateRole(name: string, initialPermissions: string[] = []) {
    const existing = await this.repository.findRoleByName(name)
    if (existing) {
      return existing
    }
    return this.repository.insertRole(name, initialPermissions)
  }

  /**
   * Appends a permission to an already-existing role, without creating a
   * new role — this is how a role's grant set grows over time.
   */
  async grantPermission(roleId: string, permission: string) {
    const role = await this.repository.findRoleById(roleId)
    if (!role) {
      throw new Error(`Agentic role ${roleId} not found`)
    }
    if (role.permissions.includes(permission)) {
      return role
    }
    return this.repository.updateRolePermissions(roleId, [
      ...role.permissions,
      permission,
    ])
  }

  /**
   * Mints a new agentic account for a tenant, scoped to one external system.
   * Returns the raw key exactly once — only its hash is persisted.
   */
  async mintAccount(
    tenantId: string,
    roleId: string,
    externalSystem: string,
    externalRef: string,
  ): Promise<MintedAgenticAccount> {
    const rawKey = generateAgenticKey()
    const keyPrefix = toKeyDisplayPrefix(rawKey)
    const keyHash = hashAgenticKey(rawKey)

    const record = await this.repository.insertAccount({
      tenantId,
      roleId,
      externalSystem,
      externalRef,
      keyPrefix,
      keyHash,
    })

    this.logger.log(
      `Minted agentic account for tenant ${tenantId} (${externalSystem})`,
    )

    return {
      rawKey,
      id: record.id,
      tenantId: record.tenantId,
      externalSystem: record.externalSystem,
      externalRef: record.externalRef,
      keyPrefix: record.keyPrefix,
      createdAt: record.createdAt,
    }
  }

  /**
   * Authenticates a presented raw key. Returns the account's tenant, role,
   * and current permission set — never a cached/stale grant, always the
   * role's live permissions at request time.
   */
  async authenticate(
    rawKey: string,
  ): Promise<AuthenticatedAgenticAccount | null> {
    const row = await this.repository.findAccountWithRoleByKeyHash(
      hashAgenticKey(rawKey),
    )

    if (!row || !row.isActive || row.revokedAt) {
      return null
    }

    await this.repository.touchAccountLastUsed(row.id)

    return {
      id: row.id,
      tenantId: row.tenantId,
      roleId: row.roleId,
      externalSystem: row.externalSystem,
      externalRef: row.externalRef,
      permissions: row.permissions,
    }
  }

  /** Revokes an agentic account — never deleted, kept for audit. */
  async revokeAccount(id: string): Promise<void> {
    await this.repository.revokeAccount(id)
    this.logger.log(`Revoked agentic account ${id}`)
  }
}
