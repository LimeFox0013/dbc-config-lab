/**
 * Port interface for `@lf/agentic-account`.
 *
 * Defines the minimum persistence contract the service needs from the host
 * application. A concrete implementation is supplied by the consuming project
 * via AgenticAccountModule.forRoot() — see `@lf/agentic-account-drizzle` for
 * the Drizzle-backed one.
 */

export interface AgenticRoleRow {
  id: string
  name: string
  permissions: string[]
  createdAt: Date
}

export interface AgenticAccountRow {
  id: string
  tenantId: string
  roleId: string
  externalSystem: string
  externalRef: string
  keyPrefix: string
  keyHash: string
  isActive: boolean
  lastUsedAt: Date | null
  createdAt: Date
  revokedAt: Date | null
}

export interface AgenticAccountWithPermissions extends AgenticAccountRow {
  permissions: string[]
}

export interface IAgenticAccountRepository {
  findRoleByName(name: string): Promise<AgenticRoleRow | undefined>
  findRoleById(roleId: string): Promise<AgenticRoleRow | undefined>
  insertRole(name: string, permissions: string[]): Promise<AgenticRoleRow>
  updateRolePermissions(
    roleId: string,
    permissions: string[],
  ): Promise<AgenticRoleRow>

  insertAccount(input: {
    tenantId: string
    roleId: string
    externalSystem: string
    externalRef: string
    keyPrefix: string
    keyHash: string
  }): Promise<AgenticAccountRow>

  /** Joins through the account's role to return its live permission set. */
  findAccountWithRoleByKeyHash(
    keyHash: string,
  ): Promise<AgenticAccountWithPermissions | undefined>

  touchAccountLastUsed(accountId: string): Promise<void>
  revokeAccount(accountId: string): Promise<void>
}
