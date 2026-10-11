import type {
  PgColumn,
  PgDatabase,
  PgQueryResultHKT,
  PgTable,
} from 'drizzle-orm/pg-core'

// Driver-agnostic — works with any Postgres Drizzle driver, since only base
// query-builder methods (insert/update/select/innerJoin) are used, never the
// schema-bound relational query API (`db.query.*`).
export type AgenticAccountDb = PgDatabase<
  PgQueryResultHKT,
  Record<string, unknown>
>

export type RoleTable = PgTable & {
  id: PgColumn
  name: PgColumn
  permissions: PgColumn
  createdAt: PgColumn
}

export type AccountTable = PgTable & {
  id: PgColumn
  tenantId: PgColumn
  roleId: PgColumn
  externalSystem: PgColumn
  externalRef: PgColumn
  keyPrefix: PgColumn
  keyHash: PgColumn
  isActive: PgColumn
  lastUsedAt: PgColumn
  createdAt: PgColumn
  revokedAt: PgColumn
}

export interface AgenticAccountDrizzleTables<
  TRoles extends RoleTable = RoleTable,
  TAccounts extends AccountTable = AccountTable,
> {
  agenticRoles: TRoles
  agenticAccounts: TAccounts
}
