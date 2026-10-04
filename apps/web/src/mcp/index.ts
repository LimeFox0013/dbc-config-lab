import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SERVER_INFO } from './constants'
import { registerActionTools } from './actions'
import { registerTools } from './tools'

export { ToolName } from './constants'

/** A lab MCP server with every tool registered, not yet connected to a transport. */
export const createLabServer = (): McpServer => {
  const server = new McpServer(SERVER_INFO)
  registerTools(server)
  registerActionTools(server)
  return server
}
