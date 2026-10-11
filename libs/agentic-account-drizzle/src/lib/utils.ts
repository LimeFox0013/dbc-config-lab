import type { AgenticAccountRow, AgenticRoleRow } from '@lf/agentic-account'
import type { AccountTable, RoleTable } from './types.js'

// Explicit per-column projections, rather than a bare `.select()`/`.returning()`
// on a generically-typed `PgTable`, so the resulting row shape is precise
// enough for TypeScript to structurally match `AgenticRoleRow`/`AgenticAccountRow`
// without a suppressive cast — a bare select on a generic table type infers
// as `Record<string, unknown>`, which doesn't have "sufficient overlap" with
// either interface for a plain `as` cast (and `as unknown as T` is forbidden
// in this codebase regardless).
export function roleColumns(roles: RoleTable) {
  return {
    id: roles.id,
    name: roles.name,
    permissions: roles.permissions,
    createdAt: roles.createdAt,
  }
}

export function accountColumns(accounts: AccountTable) {
  return {
    id: accounts.id,
    tenantId: accounts.tenantId,
    roleId: accounts.roleId,
    externalSystem: accounts.externalSystem,
    externalRef: accounts.externalRef,
    keyPrefix: accounts.keyPrefix,
    keyHash: accounts.keyHash,
    isActive: accounts.isActive,
    lastUsedAt: accounts.lastUsedAt,
    createdAt: accounts.createdAt,
    revokedAt: accounts.revokedAt,
  }
}

// A bare `PgColumn` (no per-field data-type generic — impractical to hand-roll
// correctly for every project's own table shape) infers its selected value as
// `unknown`, not its real runtime type. These narrow each already-`unknown`
// field to its known type individually — never a blanket `as unknown as T`
// object-level cast, which stays forbidden.
export function toRoleRow(row: Record<string, unknown>): AgenticRoleRow {
  return {
    id: row['id'] as string,
    name: row['name'] as string,
    permissions: row['permissions'] as string[],
    createdAt: row['createdAt'] as Date,
  }
}

export function toAccountRow(row: Record<string, unknown>): AgenticAccountRow {
  return {
    id: row['id'] as string,
    tenantId: row['tenantId'] as string,
    roleId: row['roleId'] as string,
    externalSystem: row['externalSystem'] as string,
    externalRef: row['externalRef'] as string,
    keyPrefix: row['keyPrefix'] as string,
    keyHash: row['keyHash'] as string,
    isActive: row['isActive'] as boolean,
    lastUsedAt: row['lastUsedAt'] as Date | null,
    createdAt: row['createdAt'] as Date,
    revokedAt: row['revokedAt'] as Date | null,
  }
}
