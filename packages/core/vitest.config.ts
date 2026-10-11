import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/core',
  // The DAMM v2 SDK pulls in Anchor's CommonJS build, which reads this at load time.
  define: { 'process.env.ANCHOR_BROWSER': 'true' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Several tests run full recommendation searches, which are CPU-heavy and slow down when
    // suites run in parallel. Their speed budget is asserted separately ("stays fast enough for
    // the browser"); this only keeps a busy machine from failing a correct result.
    testTimeout: 30_000,
  },
})
