import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/web',
  server: {
    port: 5180,
    host: 'localhost',
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Solana libraries import Node's `buffer`; resolve it to the browser polyfill.
      buffer: 'buffer/',
    },
  },
  plugins: [vue()],
  worker: { format: 'es' },
  // The DAMM v2 SDK pulls in Anchor's CommonJS build, which reads this at load time;
  // browsers have no `process`, so it is replaced at build time instead of shimmed.
  define: { 'process.env.ANCHOR_BROWSER': 'true' },
  optimizeDeps: {
    esbuildOptions: { define: { 'process.env.ANCHOR_BROWSER': 'true' } },
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
