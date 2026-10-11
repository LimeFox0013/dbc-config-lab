import swc from 'unplugin-swc'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
    }),
  ],
  // Workspace libs are tested against their TypeScript source, as webpack bundles it.
  resolve: {
    alias: {
      '@lf/mcp-http-sessions': resolve(
        __dirname,
        '../../libs/mcp-http-sessions/src/index.ts',
      ),
      '@lf/agentic-account-drizzle': resolve(
        __dirname,
        '../../libs/agentic-account-drizzle/src/index.ts',
      ),
      '@lf/safe-fetch': resolve(
        __dirname,
        '../../libs/safe-fetch/src/index.ts',
      ),
      '@lf/agentic-account': resolve(
        __dirname,
        '../../libs/agentic-account/src/index.ts',
      ),
    },
  },
  // The DAMM v2 SDK pulls in Anchor's CommonJS build, which reads this at load time.
  define: { 'process.env.ANCHOR_BROWSER': 'true' },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['reflect-metadata'],
    include: ['src/**/*.spec.ts'],
    // Database-backed specs share one scratch database and each migrates it, so their files run one at a time.
    fileParallelism: !process.env['TEST_DATABASE_URL'],
  },
})
