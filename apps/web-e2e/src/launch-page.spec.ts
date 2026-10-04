import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DBC_PROGRAM } from './fixtures/constants'
import { mockDevnetRpc } from './fixtures/devnet-rpc'

const CONFIG_ADDRESS = '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM'
/** The fixture config's fee claimer. */
const FEE_WALLET = '11111111111111111111111111111111'
const UNKNOWN_ADDRESS = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'

const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8'))
const config = fixture<{ base64: string }>('flat-pool-config.json')
const branding = fixture<{ address: string; safe: string; unsafe: string }>(
  'partner-branding.json',
)

/** Serves the config and, when given, its operator's branding account. */
const serve = (page: Page, brandingData?: string) =>
  mockDevnetRpc(page, {
    simulationError: null,
    accounts: {
      [CONFIG_ADDRESS]: { owner: DBC_PROGRAM, base64: config.base64 },
      ...(brandingData
        ? { [branding.address]: { owner: DBC_PROGRAM, base64: brandingData } }
        : {}),
    },
  })

const openPage = (page: Page, address: string) =>
  page.goto(`/launch/${address}?network=devnet`)

test.describe('launch page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://fair.example/**', (route) =>
      route.fulfill({ status: 404 }),
    )
  })

  test('shows the launchpad’s published name, its terms and a typical launch before any wallet', async ({
    page,
  }) => {
    await serve(page, branding.safe)
    await openPage(page, CONFIG_ADDRESS)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Fair Launches',
    )
    // A self-published name: marked unverified, its link shown as the host it opens,
    // and the fee wallet and config in full.
    await expect(page.locator('.launchpad-identity')).toContainText(
      'not verified by this site',
    )
    await expect(
      page.getByRole('link', { name: 'fair.example', exact: true }),
    ).toHaveAttribute('href', 'https://fair.example')
    await expect(page.locator('.launchpad-identity')).toContainText(FEE_WALLET)
    await expect(page.locator('.launchpad-identity')).toContainText(
      CONFIG_ADDRESS,
    )
    await expect(page.locator('.launch-view__section').first()).toContainText(
      'Trading fee',
    )
    await expect(page.locator('.comparison-table tbody tr')).toHaveCount(1)
    await expect(
      page.getByRole('textbox', { name: 'Config address' }),
    ).toHaveValue(CONFIG_ADDRESS)
    await expect(
      page.getByRole('textbox', { name: 'Config address' }),
    ).not.toBeEditable()
  })

  test('never turns branding from chain into a script link', async ({
    page,
  }) => {
    await serve(page, branding.unsafe)
    await openPage(page, CONFIG_ADDRESS)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Fair Launches',
    )
    await expect(page.locator('a[href^="javascript"]')).toHaveCount(0)
  })

  test('falls back to the fee-claiming wallet when no name is published', async ({
    page,
  }) => {
    await serve(page)
    await openPage(page, CONFIG_ADDRESS)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Launchpad 1111',
    )
    await expect(page.locator('.launch-view')).toContainText(
      'has not published a name',
    )
  })

  test('says why a config cannot be shown and offers no launch', async ({
    page,
  }) => {
    await serve(page)
    await openPage(page, UNKNOWN_ADDRESS)
    await expect(page.getByRole('alert')).toContainText(
      'No account exists at that address',
    )
    await expect(page.locator('.pool-launch')).toHaveCount(0)
  })
})
