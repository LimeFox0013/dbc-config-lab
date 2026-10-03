import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import type { ProxyOptions } from 'vite'

/**
 * The page reaches mainnet through `/rpc/mainnet` (see MAINNET_RPC_PROXY_PATH); nginx
 * serves it in production. Locally it goes to Helius when HELIUS_API_KEY is set in the
 * shell — never exposed to the page — or else to the public endpoint, which answers
 * only requests without a browser Origin, so that header is dropped.
 */
const heliusKey = process.env['HELIUS_API_KEY']
const mainnetRpcProxy: ProxyOptions = {
  target: heliusKey
    ? 'https://mainnet.helius-rpc.com'
    : 'https://api.mainnet-beta.solana.com',
  changeOrigin: true,
  ws: true,
  rewrite: () => (heliusKey ? `/?api-key=${heliusKey}` : '/'),
  configure: (proxy) => {
    proxy.on('proxyReq', (request) => request.removeHeader('origin'))
    proxy.on('proxyReqWs', (request) => request.removeHeader('origin'))
  },
}

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/web',
  server: {
    port: 5180,
    host: 'localhost',
    strictPort: true,
    proxy: { '/rpc/mainnet': mainnetRpcProxy },
  },
  preview: {
    proxy: { '/rpc/mainnet': mainnetRpcProxy },
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
