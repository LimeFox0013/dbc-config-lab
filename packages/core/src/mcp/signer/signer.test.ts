import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type { ParsedInnerInstruction, PublicKey } from '@solana/web3.js'
import { DYNAMIC_BONDING_CURVE_PROGRAM_ID } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { describe, expect, it } from 'vitest'
import { SolanaNetwork } from '../../core/shared'
import { ToolName } from '../constants'
import {
  DEFAULT_ALLOWED_PROGRAMS,
  PolicyRule,
  SIGNER_TEXT,
  SignerEnv,
  SignerStatus,
} from './constants'
import { readSpend, recordSpend } from './ledger'
import { signerFromEnv } from './load'
import type { SigningPolicy } from './types'
import {
  actionViolation,
  allowedPrograms,
  createTaskQueue,
  effectViolation,
  lamportsToSol,
  programsInvoked,
  spendFileFor,
  utcDay,
  violationText,
} from './utils'

const POLICY: SigningPolicy = {
  actions: [ToolName.ExecuteDeployConfig, ToolName.ExecuteFeeClaim],
  networks: [SolanaNetwork.Devnet],
  maxSolPerAction: 0.5,
  maxSolPerDay: 1,
}

const DBC = DYNAMIC_BONDING_CURVE_PROGRAM_ID.toBase58()
const SYSTEM = SystemProgram.programId.toBase58()
const FOREIGN_KEY = Keypair.generate().publicKey
const FOREIGN = FOREIGN_KEY.toBase58()

const sol = (amount: number): number => amount * LAMPORTS_PER_SOL

/** A folder with a keypair file and a policy file, and the environment naming them. */
const workspace = (policy: unknown) => {
  const folder = mkdtempSync(join(tmpdir(), 'dbc-lab-signer-'))
  const keypair = Keypair.generate()
  const keypairFile = join(folder, 'id.json')
  const policyFile = join(folder, 'policy.json')
  writeFileSync(keypairFile, JSON.stringify(Array.from(keypair.secretKey)))
  writeFileSync(policyFile, JSON.stringify(policy))
  return {
    keypair,
    policyFile,
    env: { [SignerEnv.Keypair]: keypairFile, [SignerEnv.Policy]: policyFile },
  }
}

const readSpendOrEmpty = (spendFile: string) => {
  const read = readSpend(spendFile)
  return read.ok ? read.record : {}
}

describe('signing policy file', () => {
  it('turns signing on with a valid keypair and policy', () => {
    const { env, keypair, policyFile } = workspace(POLICY)
    const setup = signerFromEnv(env)
    expect(setup.status).toBe(SignerStatus.On)
    if (setup.status !== SignerStatus.On) return
    expect(setup.signer.keypair.publicKey.equals(keypair.publicKey)).toBe(true)
    expect(setup.signer.policy).toEqual(POLICY)
    expect(setup.signer.spendFile).toBe(`${policyFile}.spend.json`)
  })

  it('stays off when neither variable is set', () => {
    expect(signerFromEnv({}).status).toBe(SignerStatus.Off)
  })

  it('refuses to sign when only one variable is set', () => {
    const { env } = workspace(POLICY)
    expect(
      signerFromEnv({ [SignerEnv.Keypair]: env[SignerEnv.Keypair] }),
    ).toEqual({
      status: SignerStatus.Refused,
      reason: SIGNER_TEXT.onlyOneVariable,
    })
  })

  it.each([
    ['an unknown action', { ...POLICY, actions: ['execute_everything'] }],
    ['an unknown network', { ...POLICY, networks: ['testnet'] }],
    ['no actions', { ...POLICY, actions: [] }],
    ['a zero daily limit', { ...POLICY, maxSolPerDay: 0 }],
    ['a missing per-action limit', { ...POLICY, maxSolPerAction: undefined }],
    ['a program that is not an address', { ...POLICY, programs: ['nope'] }],
    ['an unknown field', { ...POLICY, maxSolPerWeek: 3 }],
  ])('refuses a policy with %s', (_case, policy) => {
    const setup = signerFromEnv(workspace(policy).env)
    expect(setup.status).toBe(SignerStatus.Refused)
    if (setup.status !== SignerStatus.Refused) return
    expect(setup.reason).toContain(SIGNER_TEXT.unreadablePolicy)
  })

  it('refuses a keypair file that is not a keypair, without repeating it', () => {
    const { env } = workspace(POLICY)
    writeFileSync(env[SignerEnv.Keypair], JSON.stringify([1, 2, 3]))
    expect(signerFromEnv(env)).toEqual({
      status: SignerStatus.Refused,
      reason: SIGNER_TEXT.unreadableKeypair,
    })
  })

  it('refuses a policy file that is not JSON', () => {
    const { env } = workspace(POLICY)
    writeFileSync(env[SignerEnv.Policy], 'actions: everything')
    expect(signerFromEnv(env).status).toBe(SignerStatus.Refused)
  })
})

describe('policy rules', () => {
  it('refuses an action the policy does not list', () => {
    expect(
      actionViolation(
        POLICY,
        ToolName.ExecuteTokenLaunch,
        SolanaNetwork.Devnet,
      ),
    ).toMatchObject({ rule: PolicyRule.Actions })
  })

  it('refuses mainnet unless the policy lists it', () => {
    expect(
      actionViolation(
        POLICY,
        ToolName.ExecuteDeployConfig,
        SolanaNetwork.Mainnet,
      ),
    ).toMatchObject({ rule: PolicyRule.Networks })
    expect(
      actionViolation(
        { ...POLICY, networks: [SolanaNetwork.Devnet, SolanaNetwork.Mainnet] },
        ToolName.ExecuteDeployConfig,
        SolanaNetwork.Mainnet,
      ),
    ).toBeNull()
  })

  it('refuses an action over the per-action limit, all its transactions together', () => {
    const half = { lamportsSpent: sol(0.3), programs: [DBC] }
    expect(effectViolation(POLICY, [half], 0)).toBeNull()
    expect(effectViolation(POLICY, [half, half], 0)).toMatchObject({
      rule: PolicyRule.MaxSolPerAction,
    })
  })

  it('refuses an action that would take the day over its limit', () => {
    const effect = { lamportsSpent: sol(0.4), programs: [DBC] }
    expect(effectViolation(POLICY, [effect], sol(0.6))).toBeNull()
    expect(effectViolation(POLICY, [effect], sol(0.7))).toMatchObject({
      rule: PolicyRule.MaxSolPerDay,
    })
  })

  it('names the rule broken and says nothing was signed', () => {
    const text = violationText({ rule: PolicyRule.Networks, detail: 'x' })
    expect(text).toContain('(networks)')
    expect(text).toContain(SIGNER_TEXT.nothingSigned)
  })
})

describe('program allow-list', () => {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: Keypair.generate().publicKey,
      toPubkey: Keypair.generate().publicKey,
      lamports: 1,
    }),
    new TransactionInstruction({
      programId: DYNAMIC_BONDING_CURVE_PROGRAM_ID,
      keys: [],
    }),
  )
  const innerCall = (programId: PublicKey): ParsedInnerInstruction[] => [
    { index: 1, instructions: [{ programId, accounts: [], data: '' }] },
  ]

  it('collects the programs a transaction calls and those they call in turn', () => {
    expect(programsInvoked(transaction, null).sort()).toEqual(
      [SYSTEM, DBC].sort(),
    )
    expect(programsInvoked(transaction, innerCall(FOREIGN_KEY))).toContain(
      FOREIGN,
    )
  })

  it('allows the default programs and refuses any other', () => {
    expect(DEFAULT_ALLOWED_PROGRAMS).toEqual(
      expect.arrayContaining([DBC, SYSTEM]),
    )
    expect(
      effectViolation(
        POLICY,
        [{ lamportsSpent: 1, programs: [DBC, SYSTEM] }],
        0,
      ),
    ).toBeNull()
    expect(
      effectViolation(
        POLICY,
        [{ lamportsSpent: 1, programs: [DBC, FOREIGN] }],
        0,
      ),
    ).toMatchObject({ rule: PolicyRule.Programs })
  })

  it('uses the policy’s own list in place of the default one', () => {
    const own = { ...POLICY, programs: [FOREIGN] }
    expect(
      effectViolation(own, [{ lamportsSpent: 1, programs: [FOREIGN] }], 0),
    ).toBeNull()
    expect(
      effectViolation(own, [{ lamportsSpent: 1, programs: [DBC] }], 0),
    ).toMatchObject({ rule: PolicyRule.Programs })
  })
})

describe('day spend', () => {
  it('accumulates per UTC day and survives a restart', () => {
    const { env, policyFile } = workspace(POLICY)
    const spendFile = spendFileFor(policyFile)
    const day = utcDay(new Date('2026-10-05T23:59:00Z'))
    expect(day).toBe('2026-10-05')

    const first = signerFromEnv(env)
    if (first.status !== SignerStatus.On) throw new Error('signing is off')
    const start = readSpend(first.signer.spendFile)
    if (!start.ok) throw new Error('unreadable spend')
    recordSpend(spendFile, start.record, day, sol(0.25))

    // A new server process reads what the last one spent.
    const restarted = signerFromEnv(env)
    if (restarted.status !== SignerStatus.On) throw new Error('signing is off')
    const after = readSpend(restarted.signer.spendFile)
    if (!after.ok) throw new Error('unreadable spend')
    expect(after.record[day]).toBe(sol(0.25))
    recordSpend(spendFile, after.record, day, sol(0.5))
    recordSpend(spendFile, readSpendOrEmpty(spendFile), '2026-10-06', 1)

    expect(JSON.parse(readFileSync(spendFile, 'utf8'))).toEqual({
      '2026-10-05': sol(0.75),
      '2026-10-06': 1,
    })
    expect(
      effectViolation(
        POLICY,
        [{ lamportsSpent: sol(0.3), programs: [DBC] }],
        sol(0.75),
      ),
    ).toMatchObject({ rule: PolicyRule.MaxSolPerDay })
  })

  it('refuses to start signing over a spend file it cannot read', () => {
    const { env, policyFile } = workspace(POLICY)
    writeFileSync(spendFileFor(policyFile), '{"2026-10-05": "lots"}')
    const setup = signerFromEnv(env)
    expect(setup.status).toBe(SignerStatus.Refused)
  })
})

describe('signer helpers', () => {
  it('converts lamports to SOL', () => {
    expect(lamportsToSol(sol(1.5))).toBe(1.5)
  })

  it('allows the policy’s own programs, or the defaults when it lists none', () => {
    expect(allowedPrograms(POLICY)).toBe(DEFAULT_ALLOWED_PROGRAMS)
    expect(allowedPrograms({ ...POLICY, programs: [DBC] })).toEqual([DBC])
  })

  it('runs queued tasks one after another, even after one fails', async () => {
    const queue = createTaskQueue()
    const order: string[] = []
    let releaseFirst: () => void = () => undefined
    const first = queue(
      () =>
        new Promise<string>((resolve) => {
          releaseFirst = () => {
            order.push('first')
            resolve('first')
          }
        }),
    )
    const failing = queue(async () => {
      order.push('failing')
      throw new Error('boom')
    })
    const last = queue(async () => {
      order.push('last')
      return 'last'
    })

    await Promise.resolve()
    expect(order).toEqual([])
    releaseFirst()
    await expect(first).resolves.toBe('first')
    await expect(failing).rejects.toThrow('boom')
    await expect(last).resolves.toBe('last')
    expect(order).toEqual(['first', 'failing', 'last'])
  })
})
