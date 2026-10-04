/**
 * Bundles the lab's MCP server into one Node file (`mcp-package/server.mjs`) with every
 * dependency and the launchpad snapshot inlined, so `npx dbc-config-lab-mcp` runs it with
 * nothing else installed. Offline.
 *
 *   npx tsx apps/web/scripts/build-mcp.ts
 */
import { build } from 'esbuild'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const outfile = join(app, 'mcp-package', 'server.mjs')

await build({
  entryPoints: [join(app, 'src', 'mcp', 'server.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  // Bundled CommonJS dependencies still call require for Node built-ins.
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire } from 'node:module'\nconst require = createRequire(import.meta.url)",
  },
  // Identifiers stay readable so a stack trace from a user's machine still names functions.
  minifyWhitespace: true,
  minifySyntax: true,
  logLevel: 'warning',
})
console.log(`MCP server bundled: ${outfile}`)
