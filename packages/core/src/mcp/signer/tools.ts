import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  buildBranding,
  buildClaim,
  buildClone,
  buildDeploy,
  buildLaunch,
} from '../builders'
import { ToolName } from '../constants'
import {
  executeBrandingInput,
  executeClaimInput,
  executeCloneInput,
  executeDeployInput,
  executeLaunchInput,
} from '../schemas'
import { SIGNER_TEXT, SIGNING } from './constants'
import { executeAction } from './execute'
import type { PolicySigner } from './types'

/**
 * The local policy signer's tools: the same actions the previews propose, built by the
 * same builders, but signed by the configured wallet within the owner's policy.
 * Registered only for a server given a signer — never the hosted one.
 */
export const registerSigningTools = (
  server: McpServer,
  signer: PolicySigner,
): void => {
  server.registerTool(
    ToolName.ExecuteDeployConfig,
    {
      title: 'Deploy a launch config (signed locally)',
      description: `Creates a DBC config on chain with the signing wallet as fee claimer and leftover receiver. ${SIGNER_TEXT.toolPolicyNote}`,
      inputSchema: executeDeployInput,
      annotations: SIGNING,
    },
    async ({ network, config }) =>
      executeAction(signer, {
        tool: ToolName.ExecuteDeployConfig,
        network,
        build: (context) => buildDeploy(context, { config }),
      }),
  )

  server.registerTool(
    ToolName.ExecuteCloneConfig,
    {
      title: 'Deploy a copy of a real config (signed locally)',
      description: `Reads a DBC config from chain, applies the adjustments (never the curve) and creates the copy with the signing wallet as fee claimer and leftover receiver. ${SIGNER_TEXT.toolPolicyNote}`,
      inputSchema: executeCloneInput,
      annotations: SIGNING,
    },
    async ({ network, sourceAddress, sourceNetwork, adjustments }) =>
      executeAction(signer, {
        tool: ToolName.ExecuteCloneConfig,
        network,
        build: (context) =>
          buildClone(context, { sourceAddress, sourceNetwork, adjustments }),
      }),
  )

  server.registerTool(
    ToolName.ExecutePartnerBranding,
    {
      title: 'Publish launchpad branding (signed locally)',
      description: `Writes a launchpad's public name, website and logo on chain against the signing wallet — once per wallet. ${SIGNER_TEXT.toolPolicyNote}`,
      inputSchema: executeBrandingInput,
      annotations: SIGNING,
    },
    async ({ network, name, website, logo }) =>
      executeAction(signer, {
        tool: ToolName.ExecutePartnerBranding,
        network,
        build: (context) => buildBranding(context, { name, website, logo }),
      }),
  )

  server.registerTool(
    ToolName.ExecuteTokenLaunch,
    {
      title: 'Launch a token (signed locally)',
      description: `Launches a new token on a DBC config with the signing wallet as pool creator, optionally with a first buy in the same transaction; returns the new mint and pool. ${SIGNER_TEXT.toolPolicyNote}`,
      inputSchema: executeLaunchInput,
      annotations: SIGNING,
    },
    async ({ network, configAddress, name, symbol, uri, firstBuy }) =>
      executeAction(signer, {
        tool: ToolName.ExecuteTokenLaunch,
        network,
        build: (context) =>
          buildLaunch(context, { configAddress, name, symbol, uri, firstBuy }),
      }),
  )

  server.registerTool(
    ToolName.ExecuteFeeClaim,
    {
      title: 'Claim trading fees (signed locally)',
      description: `Claims everything the signing wallet is owed on one pool in one role, as find_earnings lists it. ${SIGNER_TEXT.toolPolicyNote}`,
      inputSchema: executeClaimInput,
      annotations: SIGNING,
    },
    async ({ network, pool, role }) =>
      executeAction(signer, {
        tool: ToolName.ExecuteFeeClaim,
        network,
        build: (context) => buildClaim(context, { pool, role }),
      }),
  )
}
