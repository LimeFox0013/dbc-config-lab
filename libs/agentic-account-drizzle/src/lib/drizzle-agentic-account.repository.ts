import { eq } from 'drizzle-orm'
import type {
  IAgenticAccountRepository,
  AgenticRoleRow,
  AgenticAccountRow,
  AgenticAccountWithPermissions,
} from '@lf/agentic-account'
import type { AgenticAccountDb, AgenticAccountDrizzleTables } from './types.js'
import {
  accountColumns,
  roleColumns,
  toAccountRow,
  toRoleRow,
} from './utils.js'

/**
 * Builds an `IAgenticAccountRepository` implementation backed by Drizzle,
 * generic over whatever concrete table definitions the calling project
 * already owns — no shared schema, no forced column-naming convention
 * beyond the shape each port method needs, and no NestJS coupling (each
 * project wires this into its own DI provider via
 * `AgenticAccountModule.forRoot({ repository: ... })`).
 */
export function createDrizzleAgenticAccountRepository<
  TTables extends AgenticAccountDrizzleTables,
>(db: AgenticAccountDb, tables: TTables): IAgenticAccountRepository {
  const roleCols = roleColumns(tables.agenticRoles)
  const accountCols = accountColumns(tables.agenticAccounts)

  return {
    findRoleByName: async (name): Promise<AgenticRoleRow | undefined> => {
      const [row] = await db
        .select(roleCols)
        .from(tables.agenticRoles)
        .where(eq(tables.agenticRoles.name, name))
        .limit(1)
      return row ? toRoleRow(row) : undefined
    },

    findRoleById: async (roleId): Promise<AgenticRoleRow | undefined> => {
      const [row] = await db
        .select(roleCols)
        .from(tables.agenticRoles)
        .where(eq(tables.agenticRoles.id, roleId))
        .limit(1)
      return row ? toRoleRow(row) : undefined
    },

    insertRole: async (name, permissions): Promise<AgenticRoleRow> => {
      const [row] = await db
        .insert(tables.agenticRoles)
        .values({
          name,
          permissions,
        } as TTables['agenticRoles']['$inferInsert'])
        .returning(roleCols)
      if (!row) {
        throw new Error('Agentic role row not returned after insert')
      }
      return toRoleRow(row)
    },

    updateRolePermissions: async (
      roleId,
      permissions,
    ): Promise<AgenticRoleRow> => {
      const [row] = await db
        .update(tables.agenticRoles)
        .set({ permissions } as Partial<
          TTables['agenticRoles']['$inferInsert']
        >)
        .where(eq(tables.agenticRoles.id, roleId))
        .returning(roleCols)
      if (!row) {
        throw new Error('Agentic role row not returned after update')
      }
      return toRoleRow(row)
    },

    insertAccount: async (input): Promise<AgenticAccountRow> => {
      const [row] = await db
        .insert(tables.agenticAccounts)
        .values({
          ...input,
          isActive: true,
        } as TTables['agenticAccounts']['$inferInsert'])
        .returning(accountCols)
      if (!row) {
        throw new Error('Agentic account row not returned after insert')
      }
      return toAccountRow(row)
    },

    findAccountWithRoleByKeyHash: async (
      keyHash,
    ): Promise<AgenticAccountWithPermissions | undefined> => {
      const [row] = await db
        .select({
          ...accountCols,
          permissions: tables.agenticRoles.permissions,
        })
        .from(tables.agenticAccounts)
        .innerJoin(
          tables.agenticRoles,
          eq(tables.agenticAccounts.roleId, tables.agenticRoles.id),
        )
        .where(eq(tables.agenticAccounts.keyHash, keyHash))
        .limit(1)
      if (!row) {
        return undefined
      }
      return {
        ...toAccountRow(row),
        permissions: row['permissions'] as string[],
      }
    },

    touchAccountLastUsed: async (accountId): Promise<void> => {
      await db
        .update(tables.agenticAccounts)
        .set({ lastUsedAt: new Date() } as Partial<
          TTables['agenticAccounts']['$inferInsert']
        >)
        .where(eq(tables.agenticAccounts.id, accountId))
    },

    revokeAccount: async (accountId): Promise<void> => {
      await db
        .update(tables.agenticAccounts)
        .set({
          isActive: false,
          revokedAt: new Date(),
        } as Partial<TTables['agenticAccounts']['$inferInsert']>)
        .where(eq(tables.agenticAccounts.id, accountId))
    },
  }
}
