import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {
  SignerEnv,
  SignerStatus,
  signerFromEnv,
  SIGNING_TOOLS,
} from '@dbc-config-lab/core/mcp'
import { AccountsService, KeysService, PLAN_LIMITS, PlanId } from '../accounts'
import { UsageService } from '../usage'
import { MCP_TEXT } from './constants'
import { McpController } from './mcp.controller'

const FREE_CALLS = PLAN_LIMITS[PlanId.Free].dailyCalls
const PRO_CALLS = PLAN_LIMITS[PlanId.Pro].dailyCalls
const proAccount = {
  id: 'account-1',
  walletAddress: 'wallet-1',
  paidPlan: PlanId.Pro,
  planEndsAt: new Date(Date.now() + 86_400_000),
  createdAt: new Date(),
}

/** The real controller and MCP server over HTTP; only the usage store is faked. */
describe('McpController (hosted agent endpoint)', () => {
  let app: INestApplication
  let url: string
  const usage = {
    callerForAddress: vi.fn((address: string) => `addr:hash-of-${address}`),
    callerForAccount: vi.fn((id: string) => `acct:${id}`),
    record: vi.fn(async () => 1),
  }
  const keys = {
    accountForKey: vi.fn(async (key: string) =>
      key === 'agt_valid' ? proAccount.id : null,
    ),
  }
  const accounts = { get: vi.fn(async () => proAccount) }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [McpController],
      providers: [
        { provide: UsageService, useValue: usage },
        { provide: KeysService, useValue: keys },
        { provide: AccountsService, useValue: accounts },
      ],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.listen(0, '127.0.0.1')
    const { port } = app.getHttpServer().address() as AddressInfo
    url = `http://127.0.0.1:${port}/mcp`
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    usage.record.mockClear()
    usage.record.mockResolvedValue(1)
  })

  const connect = async (key?: string) => {
    const client = new Client({ name: 'spec', version: '0.0.0' })
    await client.connect(
      new StreamableHTTPClientTransport(new URL(url), {
        requestInit: key ? { headers: { Authorization: `Bearer ${key}` } } : {},
      }),
    )
    return client
  }

  it('offers the same 13 tools as the local agent server', async () => {
    const client = await connect()
    const { tools } = await client.listTools()
    expect(tools).toHaveLength(13)
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'compare_configs',
        'preview_deploy_config',
        'find_launchpads',
      ]),
    )
    // Listing is free: only tool calls count.
    expect(usage.record).not.toHaveBeenCalled()
    await client.close()
  })

  it('never offers a signing tool, even where the signing variables are set', async () => {
    // A real keypair file (ed25519 seed, then public key) and a valid policy: all a
    // local server would need to sign.
    const folder = mkdtempSync(join(tmpdir(), 'dbc-lab-api-'))
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    const seed = Buffer.from(
      privateKey.export({ format: 'jwk' }).d ?? '',
      'base64url',
    )
    const key = Buffer.from(
      publicKey.export({ format: 'jwk' }).x ?? '',
      'base64url',
    )
    const keypairFile = join(folder, 'id.json')
    const policyFile = join(folder, 'policy.json')
    writeFileSync(keypairFile, JSON.stringify([...seed, ...key]))
    writeFileSync(
      policyFile,
      JSON.stringify({
        actions: [...SIGNING_TOOLS],
        networks: ['devnet', 'mainnet-beta'],
        maxSolPerAction: 1,
        maxSolPerDay: 1,
      }),
    )
    vi.stubEnv(SignerEnv.Keypair, keypairFile)
    vi.stubEnv(SignerEnv.Policy, policyFile)
    expect(signerFromEnv(process.env).status).toBe(SignerStatus.On)

    const client = await connect()
    const { tools } = await client.listTools()
    const signing: readonly string[] = SIGNING_TOOLS
    expect(tools.filter((tool) => signing.includes(tool.name))).toEqual([])
    expect(tools.some((tool) => tool.name.startsWith('execute_'))).toBe(false)
    await client.close()
    vi.unstubAllEnvs()
  })

  it('runs a tool and counts the call against the caller', async () => {
    const client = await connect()
    const result = await client.callTool({
      name: 'list_options',
      arguments: {},
    })
    expect(result.isError).toBeFalsy()
    expect(usage.record).toHaveBeenCalledWith('addr:hash-of-127.0.0.1', 1)
    await client.close()
  })

  it('refuses a call beyond the daily allowance with a readable reason', async () => {
    const client = await connect()
    usage.record.mockResolvedValueOnce(FREE_CALLS + 1)

    await expect(
      client.callTool({ name: 'list_options', arguments: {} }),
    ).rejects.toThrow(MCP_TEXT.addressAllowance(FREE_CALLS))
    await client.close()
  })

  it("counts a keyed call against the key's account, on that account's plan", async () => {
    const client = await connect('agt_valid')
    usage.record.mockResolvedValueOnce(FREE_CALLS + 1)

    const result = await client.callTool({ name: 'list_options', arguments: {} })

    expect(result.isError).toBeFalsy()
    expect(usage.record).toHaveBeenCalledWith('acct:account-1', 1)
    usage.record.mockResolvedValueOnce(PRO_CALLS + 1)
    await expect(
      client.callTool({ name: 'list_options', arguments: {} }),
    ).rejects.toThrow(MCP_TEXT.accountAllowance(PRO_CALLS))
    await client.close()
  })

  it('refuses an unknown or revoked key outright, never serving it as anonymous', async () => {
    await expect(connect('agt_revoked')).rejects.toThrow()
    expect(usage.record).not.toHaveBeenCalled()
  })
})
