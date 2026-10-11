import { AgenticAccountService } from '@lf/agentic-account'
import type {
  AgenticAccountRow,
  AgenticAccountWithPermissions,
  AgenticRoleRow,
  IAgenticAccountRepository,
} from '@lf/agentic-account'
import { beforeEach, describe, expect, it } from 'vitest'
import { mockDb } from '../testing/mock-db'
import {
  KEY_EXTERNAL_SYSTEM,
  MCP_CALLER_ROLE,
  MCP_TOOL_ACCESS,
} from './constants'
import { KeysService } from './keys.service'

/** `@lf/agentic-account`'s repository port, kept in memory. */
class MemoryRepository implements IAgenticAccountRepository {
  roles: AgenticRoleRow[] = []
  keys: AgenticAccountRow[] = []

  async findRoleByName(name: string): Promise<AgenticRoleRow | undefined> {
    return this.roles.find((role) => role.name === name)
  }
  async findRoleById(roleId: string): Promise<AgenticRoleRow | undefined> {
    return this.roles.find((role) => role.id === roleId)
  }
  async insertRole(
    name: string,
    permissions: string[],
  ): Promise<AgenticRoleRow> {
    const role = {
      id: `role-${this.roles.length + 1}`,
      name,
      permissions,
      createdAt: new Date(),
    }
    this.roles.push(role)
    return role
  }
  async updateRolePermissions(
    roleId: string,
    permissions: string[],
  ): Promise<AgenticRoleRow> {
    const role = await this.findRoleById(roleId)
    if (!role) throw new Error('no role')
    role.permissions = permissions
    return role
  }
  async insertAccount(
    input: Parameters<IAgenticAccountRepository['insertAccount']>[0],
  ): Promise<AgenticAccountRow> {
    const key: AgenticAccountRow = {
      ...input,
      id: `key-${this.keys.length + 1}`,
      isActive: true,
      lastUsedAt: null,
      createdAt: new Date('2026-10-05T10:00:00Z'),
      revokedAt: null,
    }
    this.keys.push(key)
    return key
  }
  async findAccountWithRoleByKeyHash(
    keyHash: string,
  ): Promise<AgenticAccountWithPermissions | undefined> {
    const key = this.keys.find((row) => row.keyHash === keyHash)
    const role = key && (await this.findRoleById(key.roleId))
    return key && role ? { ...key, permissions: role.permissions } : undefined
  }
  async touchAccountLastUsed(accountId: string): Promise<void> {
    const key = this.keys.find((row) => row.id === accountId)
    if (key) key.lastUsedAt = new Date()
  }
  async revokeAccount(accountId: string): Promise<void> {
    const key = this.keys.find((row) => row.id === accountId)
    if (key) key.isActive = false
  }
}

describe('KeysService (api-keys)', () => {
  let repository: MemoryRepository
  let keys: KeysService

  beforeEach(() => {
    repository = new MemoryRepository()
    keys = new KeysService(mockDb(), new AgenticAccountService(repository))
  })

  it('mints a key for the account under the MCP caller role, shown once with its label', async () => {
    const { key, view } = await keys.create('account-1', 'my agent')

    expect(view).toMatchObject({ label: 'my agent', lastUsedAt: null })
    expect(key.startsWith(view.prefix.replace(/\.\.\.$/, ''))).toBe(true)
    expect(repository.roles).toEqual([
      expect.objectContaining({
        name: MCP_CALLER_ROLE,
        permissions: [MCP_TOOL_ACCESS],
      }),
    ])
    expect(repository.keys[0]).toMatchObject({
      tenantId: 'account-1',
      externalSystem: KEY_EXTERNAL_SYSTEM,
      externalRef: 'my agent',
    })
    expect(JSON.stringify(repository.keys)).not.toContain(key)
  })

  it('reuses the one role for every key', async () => {
    await keys.create('account-1', 'first')
    await keys.create('account-2', 'second')
    expect(repository.roles).toHaveLength(1)
  })

  it("names the key's account only while the key is live and may call tools", async () => {
    const { key } = await keys.create('account-1', 'my agent')
    expect(await keys.accountForKey(key)).toBe('account-1')
    expect(await keys.accountForKey('agt_unknown')).toBeNull()

    const [role] = repository.roles
    if (!role) throw new Error('no role')
    role.permissions = []
    expect(await keys.accountForKey(key)).toBeNull()

    role.permissions = [MCP_TOOL_ACCESS]
    const [row] = repository.keys
    if (!row) throw new Error('no key')
    row.isActive = false
    expect(await keys.accountForKey(key)).toBeNull()
  })
})
