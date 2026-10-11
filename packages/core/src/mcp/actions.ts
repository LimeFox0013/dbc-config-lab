import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import type { Connection } from '@solana/web3.js'
import { parseAddress, reasonOf, SolanaNetwork } from '../core/shared'
import { HandoffAction, handoffPath } from '../features/agent-handoff'
import type { HandoffIntent } from '../features/agent-handoff'
import { findEarnings } from '../features/earnings'
import type { EarningsRow } from '../features/earnings'
import {
  fetchOperatorReport,
  operatorTotals,
} from '../features/operator-dashboard'
import {
  buildBranding,
  buildClaim,
  buildClone,
  buildDeploy,
  buildLaunch,
} from './builders'
import type { ActionContext, BuildResult } from './builders'
import { MCP_TEXT, READ_ONLY, ToolName } from './constants'
import {
  findEarningsInput,
  operatorDashboardInput,
  previewBrandingInput,
  previewCloneInput,
  previewClaimInput,
  previewDeployInput,
  previewLaunchInput,
} from './schemas'
import { labUrl, rpcConnection, toolRefusal, toolResult } from './utils'

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

/**
 * Builds and dry-runs an action for the owner the agent named, and hands it off: the
 * owner's page rebuilds the same transaction and only the owner's wallet signs it.
 */
const previewAction = async (
  target: ActionTarget,
  build: (context: ActionContext) => Promise<BuildResult>,
): Promise<CallToolResult> => {
  const owner = ownerOf(target)
  if (!owner.ok) return owner.result
  const connection = rpcConnection(target.network)
  const result = await build({
    connection,
    network: target.network,
    owner: owner.owner,
  })
  return result.ok
    ? preview(connection, result.built.summary, result.built.intent)
    : result.result
}

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
    async ({ config, ...target }) =>
      previewAction(target, (context) => buildDeploy(context, { config })),
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
    async ({ sourceAddress, sourceNetwork, adjustments, ...target }) =>
      previewAction(target, (context) =>
        buildClone(context, { sourceAddress, sourceNetwork, adjustments }),
      ),
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
    async ({ name, website, logo, ...target }) =>
      previewAction(target, (context) =>
        buildBranding(context, { name, website, logo }),
      ),
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
    async ({ configAddress, name, symbol, uri, firstBuy, ...target }) =>
      previewAction(target, (context) =>
        buildLaunch(context, { configAddress, name, symbol, uri, firstBuy }),
      ),
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
      const found = await findEarnings(rpcConnection(network), network, key)
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
    async ({ pool, role, ...target }) =>
      previewAction(target, (context) => buildClaim(context, { pool, role })),
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
        rpcConnection(network),
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
