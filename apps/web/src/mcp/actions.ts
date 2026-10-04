import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import type { Connection } from '@solana/web3.js'
import { clonedParameters } from '../core/config-clone'
import {
  connectionFor,
  prepareDeployment,
  prepareParametersDeployment,
} from '../core/config-deploy'
import { prepareFeeClaim } from '../core/fee-claim'
import { preparePartnerBranding } from '../core/partner-branding'
import { preparePoolLaunch } from '../core/pool-launch'
import { parseAddress, SolanaNetwork } from '../core/shared'
import { HandoffAction, handoffPath } from '../features/agent-handoff'
import type { HandoffIntent } from '../features/agent-handoff'
import { findEarnings } from '../features/earnings'
import type { EarningsRow } from '../features/earnings'
import { loadOnChainConfig } from '../features/onchain-config'
import {
  fetchOperatorReport,
  operatorTotals,
} from '../features/operator-dashboard'
import { MCP_TEXT, ToolName, UNFUNDED_DRY_RUN_ERROR } from './constants'
import {
  findEarningsInput,
  operatorDashboardInput,
  previewBrandingInput,
  previewCloneInput,
  previewClaimInput,
  previewDeployInput,
  previewLaunchInput,
} from './schemas'
import {
  labUrl,
  READ_ONLY,
  readableTerms,
  reasonOf,
  resolveDesign,
  toolRefusal,
  toolResult,
} from './utils'

/** Reads chain state and dry-runs, but never signs or sends. */
const PREVIEW = { ...READ_ONLY, openWorldHint: true } as const

interface ActionTarget {
  owner: string
  network: SolanaNetwork
  acknowledgeMainnet: boolean
}

type Owner =
  { ok: true; owner: PublicKey } | { ok: false; result: CallToolResult }

/** The owner as a key, or the refusal: an invalid address, or mainnet without the owner's say-so. */
const ownerOf = (target: ActionTarget): Owner => {
  if (target.network === SolanaNetwork.Mainnet && !target.acknowledgeMainnet)
    return { ok: false, result: toolRefusal(MCP_TEXT.mainnetNotAcknowledged) }
  const owner = parseAddress(target.owner)
  return owner
    ? { ok: true, owner }
    : { ok: false, result: toolRefusal(MCP_TEXT.invalidOwner) }
}

const handoffLink = (intent: HandoffIntent): string =>
  new URL(handoffPath(intent), labUrl()).toString()

/** A previewed action: the dry run passed; the owner signs it through the link. */
const preview = async (
  connection: Connection,
  summary: unknown,
  intent: HandoffIntent,
): Promise<CallToolResult> =>
  toolResult({
    dryRun: 'passed',
    ownerBalanceSol:
      (await connection.getBalance(new PublicKey(intent.owner))) /
      LAMPORTS_PER_SOL,
    summary,
    handoffLink: handoffLink(intent),
    note: MCP_TEXT.handoffNote,
  })

/** A failed dry run, with what to do when the owner simply has no SOL. */
const dryRunRefusal = (reason: string): CallToolResult =>
  toolRefusal(
    reason.includes(UNFUNDED_DRY_RUN_ERROR)
      ? `${reason}\n${MCP_TEXT.unfundedOwner}`
      : reason,
  )

/** An earnings row as JSON: amounts in base units, as strings. */
const earningsRow = (row: EarningsRow) => ({
  ...row,
  unclaimedQuote: row.unclaimedQuote.toString(),
  unclaimedBase: row.unclaimedBase.toString(),
})

/**
 * Agent mode: tools that propose on-chain actions. Each dry-runs the action for the
 * owner's address and returns a hand-off link where the owner signs it; nothing here
 * holds a key, signs or sends.
 */
export const registerActionTools = (server: McpServer): void => {
  server.registerTool(
    ToolName.PreviewDeployConfig,
    {
      title: 'Preview deploying a launch config',
      description:
        'Dry-runs creating a DBC config on chain for the owner — who becomes its fee claimer and leftover receiver — and returns everything the owner will sign (who earns which fees, who can withdraw the graduated liquidity, who controls the token) plus a hand-off link where the owner signs it in their own wallet.',
      inputSchema: previewDeployInput,
      annotations: PREVIEW,
    },
    async ({ config, ...target }) => {
      const owner = ownerOf(target)
      if (!owner.ok) return owner.result
      const design = resolveDesign(config)
      if (!design.ok) return toolRefusal(design.reason)
      const connection = connectionFor(target.network)
      const result = await prepareDeployment(connection, {
        config: design.shared.config,
        network: target.network,
        owner: owner.owner,
        royalty: design.shared.royalty ?? null,
      })
      if (!result.ok) return dryRunRefusal(result.reason)
      const { configAddress: _oneOff, ...summary } = result.deployment.summary
      return preview(connection, readableTerms(summary), {
        action: HandoffAction.Deploy,
        network: target.network,
        owner: owner.owner.toBase58(),
        shared: design.shared,
      })
    },
  )

  server.registerTool(
    ToolName.PreviewCloneConfig,
    {
      title: 'Preview deploying a copy of a real config',
      description:
        "Reads a DBC config from chain (a real launchpad's, say), applies the proposed adjustments — fee schedule, creator share, graduation liquidity split and locks, first buy at the minimum fee; never the curve — and dry-runs creating the copy with the owner as fee claimer and leftover receiver. Untouched, the copy has the original's exact terms. Returns the summary and a hand-off link; the owner's page reads the original again and rebuilds the copy.",
      inputSchema: previewCloneInput,
      annotations: PREVIEW,
    },
    async ({ sourceAddress, sourceNetwork, adjustments, ...target }) => {
      const owner = ownerOf(target)
      if (!owner.ok) return owner.result
      const loaded = await loadOnChainConfig(
        connectionFor(sourceNetwork),
        sourceNetwork,
        sourceAddress,
      )
      if (!loaded.ok) return toolRefusal(reasonOf(loaded))
      const clone = clonedParameters(loaded.loaded.parameters, adjustments)
      if (!clone.ok) return toolRefusal(clone.reason)
      const connection = connectionFor(target.network)
      const result = await prepareParametersDeployment(connection, {
        parameters: clone.parameters,
        quoteToken: loaded.loaded.quoteToken,
        network: target.network,
        owner: owner.owner,
        royalty: null,
      })
      if (!result.ok) return dryRunRefusal(result.reason)
      const { configAddress: _oneOff, ...summary } = result.deployment.summary
      return preview(
        connection,
        { original: loaded.loaded.configAddress, ...readableTerms(summary) },
        {
          action: HandoffAction.Clone,
          network: target.network,
          owner: owner.owner.toBase58(),
          sourceAddress: loaded.loaded.configAddress,
          sourceNetwork,
          adjustments,
        },
      )
    },
  )

  server.registerTool(
    ToolName.PreviewPartnerBranding,
    {
      title: 'Preview publishing launchpad branding',
      description:
        "Dry-runs writing a launchpad's public name, website and logo on chain against the owner's fee wallet — once per wallet; a wallet that already published one fails the dry run — and returns a hand-off link where the owner signs it.",
      inputSchema: previewBrandingInput,
      annotations: PREVIEW,
    },
    async ({ name, website, logo, ...target }) => {
      const owner = ownerOf(target)
      if (!owner.ok) return owner.result
      const branding = { name, website, logo }
      const connection = connectionFor(target.network)
      const result = await preparePartnerBranding(connection, {
        branding,
        owner: owner.owner,
      })
      if (!result.ok) return dryRunRefusal(result.reason)
      return preview(
        connection,
        {
          network: target.network,
          feeWallet: owner.owner.toBase58(),
          branding,
        },
        {
          action: HandoffAction.Branding,
          network: target.network,
          owner: owner.owner.toBase58(),
          branding,
        },
      )
    },
  )

  server.registerTool(
    ToolName.PreviewTokenLaunch,
    {
      title: 'Preview launching a token',
      description:
        'Reads a DBC config from chain and dry-runs launching a new token on it with the owner as pool creator, optionally with a first buy in the same transaction; returns the config terms the creator accepts (creation fee, fee shares, who controls the token), the simulated first-buy outcome and fee, and a hand-off link where the owner signs it.',
      inputSchema: previewLaunchInput,
      annotations: PREVIEW,
    },
    async ({ configAddress, name, symbol, uri, firstBuy, ...target }) => {
      const owner = ownerOf(target)
      if (!owner.ok) return owner.result
      const connection = connectionFor(target.network)
      const loaded = await loadOnChainConfig(
        connection,
        target.network,
        configAddress,
      )
      if (!loaded.ok) return toolRefusal(reasonOf(loaded))
      const metadata = { name, symbol, uri }
      const result = await preparePoolLaunch(connection, {
        configAddress: new PublicKey(loaded.loaded.configAddress),
        parameters: loaded.loaded.parameters,
        quoteToken: loaded.loaded.quoteToken,
        network: target.network,
        owner: owner.owner,
        metadata,
        firstBuy,
      })
      if (!result.ok) return dryRunRefusal(result.reason)
      const {
        mintAddress: _mint,
        poolAddress: _pool,
        ...summary
      } = result.launch.summary
      return preview(
        connection,
        { ...summary, terms: readableTerms(summary.terms) },
        {
          action: HandoffAction.Launch,
          network: target.network,
          owner: owner.owner.toBase58(),
          configAddress: loaded.loaded.configAddress,
          metadata,
          firstBuy,
        },
      )
    },
  )

  server.registerTool(
    ToolName.FindEarnings,
    {
      title: 'Find unclaimed trading fees',
      description:
        "Every DBC pool on which a wallet has trading fees to claim: as a config's fee claimer (partner), as a pool's creator, or as a royalty vault recipient. Amounts are base units of the quote and launched tokens; valueSol prices both at the pool's price. Read-only.",
      inputSchema: findEarningsInput,
      annotations: PREVIEW,
    },
    async ({ owner, network }) => {
      const key = parseAddress(owner)
      if (!key) return toolRefusal(MCP_TEXT.invalidOwner)
      const found = await findEarnings(connectionFor(network), network, key)
      if (!found.ok) return toolRefusal(reasonOf(found))
      return toolResult({
        network,
        owner: key.toBase58(),
        totalRows: found.earnings.totalRows,
        rows: found.earnings.rows.map(earningsRow),
        claimLink: handoffLink({
          action: HandoffAction.Claim,
          network,
          owner: key.toBase58(),
        }),
      })
    },
  )

  server.registerTool(
    ToolName.PreviewFeeClaim,
    {
      title: 'Preview claiming trading fees',
      description:
        'Dry-runs claiming everything the owner is owed on one pool in one role (as find_earnings lists it) and returns the amounts and a hand-off link, where the owner finds the same pool and signs the claim in their own wallet.',
      inputSchema: previewClaimInput,
      annotations: PREVIEW,
    },
    async ({ pool, role, ...target }) => {
      const owner = ownerOf(target)
      if (!owner.ok) return owner.result
      const poolKey = parseAddress(pool)
      if (!poolKey) return toolRefusal(MCP_TEXT.invalidPool)
      const connection = connectionFor(target.network)
      const found = await findEarnings(connection, target.network, owner.owner)
      if (!found.ok) return toolRefusal(reasonOf(found))
      const row = found.earnings.rows.find(
        (candidate) =>
          candidate.pool === poolKey.toBase58() && candidate.role === role,
      )
      if (!row) return toolRefusal(MCP_TEXT.nothingToClaim)
      const result = await prepareFeeClaim(connection, {
        pool: poolKey,
        role,
        network: target.network,
        owner: owner.owner,
        maxQuoteAmount: row.unclaimedQuote,
        maxBaseAmount: row.unclaimedBase,
        vault: row.vault ? new PublicKey(row.vault) : null,
        config: row.config ? new PublicKey(row.config) : null,
      })
      if (!result.ok) return dryRunRefusal(result.reason)
      return preview(connection, result.claim.summary, {
        action: HandoffAction.Claim,
        network: target.network,
        owner: owner.owner.toBase58(),
      })
    },
  )

  server.registerTool(
    ToolName.ReadOperatorDashboard,
    {
      title: "Read a launchpad's live dashboard",
      description:
        'For one launchpad fee wallet: every config it collects fees for — launches, graduations, lifetime curve fees and what is still unclaimed — and what its graduated-pool positions have earned, with totals. Amounts in SOL. Read-only; the wallet does not have to be the caller’s.',
      inputSchema: operatorDashboardInput,
      annotations: PREVIEW,
    },
    async ({ feeWallet, network }) => {
      const found = await fetchOperatorReport(
        connectionFor(network),
        network,
        feeWallet,
      )
      if (!found.ok) return toolRefusal(reasonOf(found))
      return toolResult({
        network,
        ...found.report,
        totals: operatorTotals(found.report),
      })
    },
  )
}
