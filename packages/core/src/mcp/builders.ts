import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { PublicKey } from '@solana/web3.js'
import type { Connection } from '@solana/web3.js'
import { clonedParameters } from '../core/config-clone'
import {
  prepareDeployment,
  prepareParametersDeployment,
} from '../core/config-deploy'
import type { PreparedTransaction } from '../core/config-deploy'
import { prepareFeeClaim } from '../core/fee-claim'
import { preparePartnerBranding } from '../core/partner-branding'
import { preparePoolLaunch } from '../core/pool-launch'
import { parseAddress, reasonOf } from '../core/shared'
import type { SolanaNetwork } from '../core/shared'
import { HandoffAction } from '../features/agent-handoff'
import type { HandoffIntent } from '../features/agent-handoff'
import { findEarnings } from '../features/earnings'
import { loadOnChainConfig } from '../features/onchain-config'
import { MCP_TEXT, UNFUNDED_DRY_RUN_ERROR } from './constants'
import type {
  BrandingFields,
  ClaimFields,
  CloneFields,
  DeployFields,
  LaunchFields,
} from './schemas'
import {
  readableTerms,
  resolveDesign,
  rpcConnection,
  toolRefusal,
} from './utils'

/** Where an action runs and the wallet that pays for, owns and signs it. */
export interface ActionContext {
  connection: Connection
  network: SolanaNetwork
  owner: PublicKey
}

/**
 * One on-chain action, built and dry-run for its owner: the transaction the hand-off page
 * and a signing tool would sign, what an agent is shown about it, and the intent a
 * hand-off link carries.
 */
export interface BuiltAction {
  prepared: PreparedTransaction
  summary: unknown
  intent: HandoffIntent
  /** Addresses of the one-off accounts this exact transaction creates. */
  created: Record<string, string>
}

export type BuildResult =
  { ok: true; built: BuiltAction } | { ok: false; result: CallToolResult }

/** A failed dry run, with what to do when the owner simply has no SOL. */
const dryRunRefusal = (reason: string): BuildResult => ({
  ok: false,
  result: toolRefusal(
    reason.includes(UNFUNDED_DRY_RUN_ERROR)
      ? `${reason}\n${MCP_TEXT.unfundedOwner}`
      : reason,
  ),
})

const refused = (reason: string): BuildResult => ({
  ok: false,
  result: toolRefusal(reason),
})

export const buildDeploy = async (
  { connection, network, owner }: ActionContext,
  { config }: DeployFields,
): Promise<BuildResult> => {
  const design = resolveDesign(config)
  if (!design.ok) return refused(design.reason)
  const result = await prepareDeployment(connection, {
    config: design.shared.config,
    network,
    owner,
    royalty: design.shared.royalty ?? null,
  })
  if (!result.ok) return dryRunRefusal(result.reason)
  const { configAddress, ...summary } = result.deployment.summary
  return {
    ok: true,
    built: {
      prepared: result.deployment,
      summary: readableTerms(summary),
      intent: {
        action: HandoffAction.Deploy,
        network,
        owner: owner.toBase58(),
        shared: design.shared,
      },
      created: { configAddress },
    },
  }
}

export const buildClone = async (
  { connection, network, owner }: ActionContext,
  { sourceAddress, sourceNetwork, adjustments }: CloneFields,
): Promise<BuildResult> => {
  const loaded = await loadOnChainConfig(
    rpcConnection(sourceNetwork),
    sourceNetwork,
    sourceAddress,
  )
  if (!loaded.ok) return refused(reasonOf(loaded))
  const clone = clonedParameters(loaded.loaded.parameters, adjustments)
  if (!clone.ok) return refused(clone.reason)
  const result = await prepareParametersDeployment(connection, {
    parameters: clone.parameters,
    quoteToken: loaded.loaded.quoteToken,
    network,
    owner,
    royalty: null,
  })
  if (!result.ok) return dryRunRefusal(result.reason)
  const { configAddress, ...summary } = result.deployment.summary
  return {
    ok: true,
    built: {
      prepared: result.deployment,
      summary: {
        original: loaded.loaded.configAddress,
        ...readableTerms(summary),
      },
      intent: {
        action: HandoffAction.Clone,
        network,
        owner: owner.toBase58(),
        sourceAddress: loaded.loaded.configAddress,
        sourceNetwork,
        adjustments,
      },
      created: { configAddress },
    },
  }
}

export const buildBranding = async (
  { connection, network, owner }: ActionContext,
  { name, website, logo }: BrandingFields,
): Promise<BuildResult> => {
  const branding = { name, website, logo }
  const result = await preparePartnerBranding(connection, { branding, owner })
  if (!result.ok) return dryRunRefusal(result.reason)
  return {
    ok: true,
    built: {
      prepared: result.prepared,
      summary: { network, feeWallet: owner.toBase58(), branding },
      intent: {
        action: HandoffAction.Branding,
        network,
        owner: owner.toBase58(),
        branding,
      },
      created: {},
    },
  }
}

export const buildLaunch = async (
  { connection, network, owner }: ActionContext,
  { configAddress, name, symbol, uri, firstBuy }: LaunchFields,
): Promise<BuildResult> => {
  const loaded = await loadOnChainConfig(connection, network, configAddress)
  if (!loaded.ok) return refused(reasonOf(loaded))
  const metadata = { name, symbol, uri }
  const result = await preparePoolLaunch(connection, {
    configAddress: new PublicKey(loaded.loaded.configAddress),
    parameters: loaded.loaded.parameters,
    quoteToken: loaded.loaded.quoteToken,
    network,
    owner,
    metadata,
    firstBuy,
  })
  if (!result.ok) return dryRunRefusal(result.reason)
  const { mintAddress, poolAddress, ...summary } = result.launch.summary
  return {
    ok: true,
    built: {
      prepared: result.launch,
      summary: { ...summary, terms: readableTerms(summary.terms) },
      intent: {
        action: HandoffAction.Launch,
        network,
        owner: owner.toBase58(),
        configAddress: loaded.loaded.configAddress,
        metadata,
        firstBuy,
      },
      created: { mintAddress, poolAddress },
    },
  }
}

export const buildClaim = async (
  { connection, network, owner }: ActionContext,
  { pool, role }: ClaimFields,
): Promise<BuildResult> => {
  const poolKey = parseAddress(pool)
  if (!poolKey) return refused(MCP_TEXT.invalidPool)
  const found = await findEarnings(connection, network, owner)
  if (!found.ok) return refused(reasonOf(found))
  const row = found.earnings.rows.find(
    (candidate) =>
      candidate.pool === poolKey.toBase58() && candidate.role === role,
  )
  if (!row) return refused(MCP_TEXT.nothingToClaim)
  const result = await prepareFeeClaim(connection, {
    pool: poolKey,
    role,
    network,
    owner,
    maxQuoteAmount: row.unclaimedQuote,
    maxBaseAmount: row.unclaimedBase,
    vault: row.vault ? new PublicKey(row.vault) : null,
    config: row.config ? new PublicKey(row.config) : null,
  })
  if (!result.ok) return dryRunRefusal(result.reason)
  return {
    ok: true,
    built: {
      prepared: result.claim,
      summary: result.claim.summary,
      intent: {
        action: HandoffAction.Claim,
        network,
        owner: owner.toBase58(),
      },
      created: {},
    },
  }
}
