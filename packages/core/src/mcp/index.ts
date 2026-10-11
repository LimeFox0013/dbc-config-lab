import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SERVER_INFO } from './constants'
import { registerActionTools } from './actions'
import { registerSigningTools } from './signer'
import type { PolicySigner } from './signer'
import { registerTools } from './tools'

export { ToolName } from './constants'
export { rpcConnection, labUrl } from './utils'
export {
  SIGNER_TEXT,
  SignerEnv,
  SignerStatus,
  signerFromEnv,
  SIGNING_TOOLS,
} from './signer'
export type { PolicySigner, SignerSetup } from './signer'

export interface LabServerOptions {
  /**
   * The local policy signer. Only the locally run server passes one; without it — the
   * default, and always on the hosted endpoint — no tool signs or sends anything.
   */
  signer?: PolicySigner
}

/** A lab MCP server with its tools registered, not yet connected to a transport. */
export const createLabServer = ({
  signer,
}: LabServerOptions = {}): McpServer => {
  const server = new McpServer(SERVER_INFO)
  registerTools(server)
  registerActionTools(server)
  if (signer) registerSigningTools(server, signer)
  return server
}
