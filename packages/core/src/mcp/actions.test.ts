import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'
import { Connection, Keypair } from '@solana/web3.js'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type * as ConfigDeploy from '../core/config-deploy'
import { FeeRole } from '../core/fee-claim'
import { LaunchPresetId } from '../core/launch-config'
import { SolanaNetwork } from '../core/shared'
import { decodeHandoff, HandoffAction } from '../features/agent-handoff'
import { OperatorRejection } from '../features/operator-dashboard'
import { ConfigSource, MCP_TEXT } from './constants'
import { createLabServer, ToolName } from '.'

/** One devnet connection whose dry runs pass and whose account lookups find nothing. */
const connection = new Connection('http://127.0.0.1:1')

vi.mock('../core/config-deploy', async (importOriginal) => ({
  ...(await importOriginal<typeof ConfigDeploy>()),
  connectionFor: () => connection,
}))

const OWNER = Keypair.generate().publicKey.toBase58()
const client = new Client({ name: 'mcp-actions-test', version: '0.0.0' })

beforeAll(async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await createLabServer().connect(serverSide)
  await client.connect(clientSide)
})

const simulate = vi.spyOn(connection, 'simulateTransaction')

beforeEach(() => {
  vi.spyOn(connection, 'getLatestBlockhash').mockResolvedValue({
    blockhash: Keypair.generate().publicKey.toBase58(),
    lastValidBlockHeight: 1,
  })
  simulate.mockReset().mockResolvedValue({
    context: { slot: 1 },
    value: {
      err: null,
      logs: [],
      accounts: null,
      unitsConsumed: 0,
      returnData: null,
    },
  })
  vi.spyOn(connection, 'getProgramAccounts').mockResolvedValue([])
  vi.spyOn(connection, 'getAccountInfo').mockResolvedValue(null)
  vi.spyOn(connection, 'getMultipleAccountsInfo').mockResolvedValue([])
  vi.spyOn(connection, 'getBalance').mockResolvedValue(2_500_000_000)
})

const call = async (name: ToolName, args: Record<string, unknown>) => {
  const result = CallToolResultSchema.parse(
    await client.callTool({ name, arguments: args }),
  )
  const text = result.content.find((part) => part.type === 'text')
  return {
    isError: result.isError === true,
    text: text?.type === 'text' ? text.text : '',
  }
}

const previewSchema = z.object({
  dryRun: z.literal('passed'),
  ownerBalanceSol: z.number(),
  summary: z.record(z.unknown()),
  handoffLink: z.string(),
})

const hashOf = (link: string): string => new URL(link).hash

const flatPreset = { source: ConfigSource.Preset, id: LaunchPresetId.Flat }

describe('agent-mode tools', () => {
  it('previews a deploy for the owner and hands off the same config', async () => {
    const { isError, text } = await call(ToolName.PreviewDeployConfig, {
      owner: OWNER,
      config: flatPreset,
    })
    expect(isError, text).toBe(false)
    const result = previewSchema.parse(JSON.parse(text))
    expect(result.summary).toMatchObject({
      network: SolanaNetwork.Devnet,
      payer: OWNER,
      feeClaimer: OWNER,
      leftoverReceiver: OWNER,
    })
    expect(result.summary).not.toHaveProperty('configAddress')
    expect(result.ownerBalanceSol).toBe(2.5)
    // SDK option numbers arrive as the SDK's names for them.
    expect(result.summary['tokenAuthority']).toBe('Immutable')
    expect(result.summary['feesCollectedIn']).toBe('QuoteToken')
    const handoff = decodeHandoff(hashOf(result.handoffLink))
    expect(handoff).toMatchObject({
      ok: true,
      intent: {
        action: HandoffAction.Deploy,
        network: SolanaNetwork.Devnet,
        owner: OWNER,
      },
    })
    expect(simulate).toHaveBeenCalledOnce()
  })

  it('refuses a mainnet action the agent has not acknowledged', async () => {
    const { isError, text } = await call(ToolName.PreviewDeployConfig, {
      owner: OWNER,
      network: SolanaNetwork.Mainnet,
      config: flatPreset,
    })
    expect(isError).toBe(true)
    expect(text).toBe(MCP_TEXT.mainnetNotAcknowledged)
    expect(simulate).not.toHaveBeenCalled()
  })

  it('refuses an owner that is not an address', async () => {
    const { isError, text } = await call(ToolName.PreviewPartnerBranding, {
      owner: 'not-an-address',
      name: 'Pad',
    })
    expect(isError).toBe(true)
    expect(text).toBe(MCP_TEXT.invalidOwner)
  })

  it('reports a failing dry run instead of a hand-off', async () => {
    simulate.mockResolvedValue({
      context: { slot: 1 },
      value: {
        err: 'AccountNotFound',
        logs: [],
        accounts: null,
        unitsConsumed: 0,
        returnData: null,
      },
    })
    const { isError, text } = await call(ToolName.PreviewDeployConfig, {
      owner: OWNER,
      config: flatPreset,
    })
    expect(isError).toBe(true)
    expect(text).toContain('Dry run failed')
    expect(text).toContain(MCP_TEXT.unfundedOwner)
  })

  it('refuses a clone whose original is not on chain', async () => {
    const { isError } = await call(ToolName.PreviewCloneConfig, {
      owner: OWNER,
      sourceAddress: Keypair.generate().publicKey.toBase58(),
      sourceNetwork: SolanaNetwork.Devnet,
    })
    expect(isError).toBe(true)
  })

  it('previews branding and refuses branding the screens would refuse', async () => {
    const ok = await call(ToolName.PreviewPartnerBranding, {
      owner: OWNER,
      name: 'Pad',
      website: 'https://pad.example',
    })
    expect(ok.isError, ok.text).toBe(false)
    const result = previewSchema.parse(JSON.parse(ok.text))
    expect(decodeHandoff(hashOf(result.handoffLink))).toMatchObject({
      ok: true,
      intent: {
        action: HandoffAction.Branding,
        branding: { name: 'Pad', website: 'https://pad.example', logo: '' },
      },
    })
    const refused = await call(ToolName.PreviewPartnerBranding, {
      owner: OWNER,
      name: 'Pad',
      website: 'http://pad.example',
    })
    expect(refused.isError).toBe(true)
  })

  it('refuses a launch on a config that is not on chain', async () => {
    const { isError } = await call(ToolName.PreviewTokenLaunch, {
      owner: OWNER,
      configAddress: Keypair.generate().publicKey.toBase58(),
      name: 'Token',
      symbol: 'TKN',
    })
    expect(isError).toBe(true)
  })

  it('finds no earnings for a fresh wallet and still links the claim page', async () => {
    const { isError, text } = await call(ToolName.FindEarnings, {
      owner: OWNER,
    })
    expect(isError, text).toBe(false)
    const result = z
      .object({ rows: z.array(z.unknown()), claimLink: z.string() })
      .parse(JSON.parse(text))
    expect(result.rows).toEqual([])
    expect(decodeHandoff(hashOf(result.claimLink))).toMatchObject({
      ok: true,
      intent: { action: HandoffAction.Claim, owner: OWNER },
    })
  })

  it('refuses a claim on a pool with nothing owed', async () => {
    const { isError, text } = await call(ToolName.PreviewFeeClaim, {
      owner: OWNER,
      pool: Keypair.generate().publicKey.toBase58(),
      role: FeeRole.Partner,
    })
    expect(isError).toBe(true)
    expect(text).toBe(MCP_TEXT.nothingToClaim)
  })

  it('says when a fee wallet collects fees for no config', async () => {
    const { isError, text } = await call(ToolName.ReadOperatorDashboard, {
      feeWallet: OWNER,
      network: SolanaNetwork.Devnet,
    })
    expect(isError).toBe(true)
    expect(text).toBe(OperatorRejection.NoConfigs)
  })
})
