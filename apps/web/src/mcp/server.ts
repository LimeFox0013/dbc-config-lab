/**
 * DBC Config Lab as an MCP server over stdio: agents simulate, compare, recommend, read
 * on-chain configs and export SDK code, and preview deploys, launches, branding and fee
 * claims for an owner to sign through a hand-off link. It never signs or sends a transaction.
 *
 *   npx tsx src/mcp/server.ts   (from this app's folder; the README has client setup)
 *   npm run build:mcp           (bundles it into mcp-package/server.mjs for npx)
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createLabServer } from './index'

await createLabServer().connect(new StdioServerTransport())
