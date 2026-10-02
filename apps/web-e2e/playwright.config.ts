import { defineConfig, devices } from '@playwright/test'

/**
 * The app is a static SPA with no backend, so the suite starts its own Vite dev server.
 * Devnet RPC calls and the wallet are faked per test (src/fixtures) — nothing here
 * touches a real network or key.
 */
const PORT = 5181
const WEB_URL = process.env['E2E_WEB_URL'] ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './src',
  outputDir: './test-results',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: [
    ['html', { outputFolder: './playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: process.env['E2E_WEB_URL']
    ? undefined
    : {
        command: `npx vite --port ${PORT} --strictPort`,
        cwd: '../web',
        url: WEB_URL,
        reuseExistingServer: !process.env['CI'],
        timeout: 60_000,
      },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
})
