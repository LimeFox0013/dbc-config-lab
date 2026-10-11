/**
 * DBC Config Lab as an MCP server over stdio: agents simulate, compare, recommend, read
 * on-chain configs and export SDK code, and preview deploys, launches, branding and fee
 * claims for an owner to sign through a hand-off link. Only when `DBC_LAB_KEYPAIR` and
 * `DBC_LAB_POLICY` both name valid files does it also offer `execute_*` tools, which sign
 * with that keypair within that policy.
 *
 *   npx tsx src/mcp/server.ts   (from this app's folder; the README has client setup)
 *   npm run build:mcp           (bundles it into mcp-package/server.mjs for npx)
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  createLabServer,
  SIGNER_TEXT,
  signerFromEnv,
  SignerStatus,
} from './index'

const setup = signerFromEnv(process.env)
// stdout carries the protocol; the owner reads why signing is off in the client's server log.
if (setup.status === SignerStatus.Refused)
  console.error(`${SIGNER_TEXT.signingOff} ${setup.reason}`)

await createLabServer({
  signer: setup.status === SignerStatus.On ? setup.signer : undefined,
}).connect(new StdioServerTransport())
