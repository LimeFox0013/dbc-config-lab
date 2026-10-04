/**
 * DBC Config Lab as an MCP server over stdio: agents simulate, compare, recommend, read
 * on-chain configs and export SDK code. Read-only — it never signs or sends a transaction.
 *
 *   npx tsx src/mcp/server.ts   (from this app's folder; the README has client setup)
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createLabServer } from './index'

await createLabServer().connect(new StdioServerTransport())
