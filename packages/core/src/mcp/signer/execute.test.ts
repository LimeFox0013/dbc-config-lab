import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
} from '@solana/web3.js'
import type { ParsedInnerInstruction } from '@solana/web3.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type * as ConfigDeploy from '../../core/config-deploy'
import { LaunchPresetId } from '../../core/launch-config'
import { SolanaNetwork } from '../../core/shared'
import { ConfigSource, ToolName } from '../constants'
import { createLabServer } from '..'
import { SIGNING_TOOLS, SignerEnv, SignerStatus } from './constants'
import { signerFromEnv } from './load'
import type { SigningPolicy } from './types'
import { spendFileFor, utcDay } from './utils'

/** One devnet connection: dry runs pass, lookups find nothing, sends are captured. */
const connection = new Connection('http://127.0.0.1:1')

vi.mock('../../core/config-deploy', async (importOriginal) => ({
  ...(await importOriginal<typeof ConfigDeploy>()),
  connectionFor: () => connection,
}))

const BALANCE = 2 * LAMPORTS_PER_SOL
const FEE = 5_000
const SIGNATURE = 'simulated-signature'

const POLICY: SigningPolicy = {
  actions: [ToolName.ExecuteDeployConfig, ToolName.ExecutePartnerBranding],
  networks: [SolanaNetwork.Devnet],
  maxSolPerAction: 0.4,
  maxSolPerDay: 0.5,
}

const flatPreset = { source: ConfigSource.Preset, id: LaunchPresetId.Flat }

/** What the next simulations report: SOL leaving the signer and programs called inside. */
let simulatedSpend = 0
let innerInstructions: ParsedInnerInstruction[] = []

const simulate = vi.spyOn(connection, 'simulateTransaction')
const send = vi.spyOn(connection, 'sendRawTransaction')

beforeEach(() => {
  simulatedSpend = 0.1 * LAMPORTS_PER_SOL
  innerInstructions = []
  vi.spyOn(connection, 'getLatestBlockhash').mockResolvedValue({
    blockhash: Keypair.generate().publicKey.toBase58(),
    lastValidBlockHeight: 100,
  })
  simulate.mockReset().mockImplementation(async () => ({
    context: { slot: 1 },
    value: {
      err: null,
      logs: [],
      accounts: [
        {
          executable: false,
          owner: SystemProgram.programId.toBase58(),
          lamports: BALANCE - simulatedSpend,
          data: ['', 'base64'],
        },
      ],
      unitsConsumed: 0,
      returnData: null,
      innerInstructions,
    },
  }))
  vi.spyOn(connection, 'getBalance').mockResolvedValue(BALANCE)
  vi.spyOn(connection, 'getFeeForMessage').mockResolvedValue({
    context: { slot: 1 },
    value: FEE,
  })
  vi.spyOn(connection, 'getAccountInfo').mockResolvedValue(null)
  vi.spyOn(connection, 'getMultipleAccountsInfo').mockResolvedValue([])
  vi.spyOn(connection, 'getProgramAccounts').mockResolvedValue([])
  send.mockReset().mockResolvedValue(SIGNATURE)
  vi.spyOn(connection, 'confirmTransaction').mockResolvedValue({
    context: { slot: 2 },
    value: { err: null },
  })
})

/** A local server whose environment names a fresh keypair and this policy. */
const signingServer = async (policy: unknown = POLICY) => {
  const folder = mkdtempSync(join(tmpdir(), 'dbc-lab-execute-'))
  const keypair = Keypair.generate()
  const keypairFile = join(folder, 'id.json')
  const policyFile = join(folder, 'policy.json')
  writeFileSync(keypairFile, JSON.stringify(Array.from(keypair.secretKey)))
  writeFileSync(policyFile, JSON.stringify(policy))
  const setup = signerFromEnv({
    [SignerEnv.Keypair]: keypairFile,
    [SignerEnv.Policy]: policyFile,
  })
  if (setup.status !== SignerStatus.On) throw new Error('signing is off')
  const client = new Client({ name: 'mcp-signer-test', version: '0.0.0' })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await createLabServer({ signer: setup.signer }).connect(serverSide)
  await client.connect(clientSide)
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
  return { client, call, keypair, spendFile: spendFileFor(policyFile) }
}

const sentSchema = z.object({
  sent: z.literal(true),
  network: z.string(),
  signer: z.string(),
  signatures: z.array(z.string()),
  explorer: z.array(z.string()),
  created: z.record(z.string()),
  summary: z.record(z.unknown()),
  spentSol: z.number(),
  spentLamports: z.number(),
  spentTodaySol: z.number(),
})

const spentToday = (spendFile: string): number =>
  z.record(z.number()).parse(JSON.parse(readFileSync(spendFile, 'utf8')))[
    utcDay(new Date())
  ] ?? 0

describe('local policy signer', () => {
  it('offers the signing tools only when given a signer', async () => {
    const { client } = await signingServer()
    const names = (await client.listTools()).tools.map((tool) => tool.name)
    expect(names).toEqual(expect.arrayContaining([...SIGNING_TOOLS]))

    const plain = new Client({ name: 'mcp-plain-test', version: '0.0.0' })
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    const setup = signerFromEnv({})
    expect(setup.status).toBe(SignerStatus.Off)
    await createLabServer().connect(serverSide)
    await plain.connect(clientSide)
    const plainNames = (await plain.listTools()).tools.map((tool) => tool.name)
    expect(plainNames.filter((name) => name.startsWith('execute_'))).toEqual([])
  })

  it('builds, simulates, checks, signs, sends, confirms and records a deploy', async () => {
    const { call, keypair, spendFile } = await signingServer()
    const { isError, text } = await call(ToolName.ExecuteDeployConfig, {
      config: flatPreset,
    })
    expect(isError, text).toBe(false)
    const result = sentSchema.parse(JSON.parse(text))
    const owner = keypair.publicKey.toBase58()
    expect(result).toMatchObject({
      network: SolanaNetwork.Devnet,
      signer: owner,
      signatures: [SIGNATURE],
    })
    expect(result.summary).toMatchObject({ feeClaimer: owner, payer: owner })
    expect(result.created['configAddress']).toEqual(expect.any(String))
    const spent = 0.1 * LAMPORTS_PER_SOL + FEE
    expect(result.spentLamports).toBe(spent)

    // The builder's dry run, then the policy's simulation with the signer's balance.
    expect(simulate).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenCalledOnce()
    const raw = send.mock.calls[0]?.[0]
    if (!(raw instanceof Buffer)) throw new Error('nothing was sent')
    const sent = Transaction.from(raw)
    expect(sent.feePayer?.equals(keypair.publicKey)).toBe(true)
    expect(sent.verifySignatures()).toBe(true)
    expect(spentToday(spendFile)).toBe(spent)
  })

  it('refuses an action over the per-action limit and signs nothing', async () => {
    const { call, spendFile } = await signingServer()
    simulatedSpend = 0.45 * LAMPORTS_PER_SOL
    const { isError, text } = await call(ToolName.ExecuteDeployConfig, {
      config: flatPreset,
    })
    expect(isError).toBe(true)
    expect(text).toContain('(maxSolPerAction)')
    expect(send).not.toHaveBeenCalled()
    expect(() => readFileSync(spendFile)).toThrow()
  })

  it('refuses the action that would take the day over its limit', async () => {
    const { call } = await signingServer()
    simulatedSpend = 0.3 * LAMPORTS_PER_SOL
    const first = await call(ToolName.ExecuteDeployConfig, {
      config: flatPreset,
    })
    expect(first.isError, first.text).toBe(false)
    const second = await call(ToolName.ExecuteDeployConfig, {
      config: flatPreset,
    })
    expect(second.isError).toBe(true)
    expect(second.text).toContain('(maxSolPerDay)')
    expect(send).toHaveBeenCalledOnce()
  })

  it('refuses a transaction that calls a program the policy does not allow', async () => {
    const { call } = await signingServer()
    innerInstructions = [
      {
        index: 0,
        instructions: [
          {
            programId: Keypair.generate().publicKey,
            accounts: [],
            data: '',
          },
        ],
      },
    ]
    const { isError, text } = await call(ToolName.ExecuteDeployConfig, {
      config: flatPreset,
    })
    expect(isError).toBe(true)
    expect(text).toContain('(programs)')
    expect(send).not.toHaveBeenCalled()
  })

  it('refuses mainnet unless the policy lists it, before building anything', async () => {
    const { call } = await signingServer()
    const { isError, text } = await call(ToolName.ExecuteDeployConfig, {
      network: SolanaNetwork.Mainnet,
      config: flatPreset,
    })
    expect(isError).toBe(true)
    expect(text).toContain('(networks)')
    expect(simulate).not.toHaveBeenCalled()
  })

  it('refuses an action the policy does not list', async () => {
    const { call } = await signingServer()
    const { isError, text } = await call(ToolName.ExecuteFeeClaim, {
      pool: Keypair.generate().publicKey.toBase58(),
      role: 'partner',
    })
    expect(isError).toBe(true)
    expect(text).toContain('(actions)')
    expect(send).not.toHaveBeenCalled()
  })

  it('refuses a failing simulation without signing', async () => {
    const { call } = await signingServer()
    // The builder's own dry run passes; the policy's simulation fails.
    simulate.mockImplementationOnce(async () => ({
      context: { slot: 1 },
      value: {
        err: null,
        logs: [],
        accounts: null,
        unitsConsumed: 0,
        returnData: null,
      },
    }))
    simulate.mockImplementationOnce(async () => ({
      context: { slot: 1 },
      value: {
        err: { InstructionError: [0, 'Custom'] },
        logs: ['failed'],
        accounts: null,
        unitsConsumed: 0,
        returnData: null,
      },
    }))
    const { isError, text } = await call(ToolName.ExecutePartnerBranding, {
      name: 'Pad',
    })
    expect(isError).toBe(true)
    expect(text).toContain('Dry run failed')
    expect(send).not.toHaveBeenCalled()
  })
})
