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
const branding = fixture<{ address: string; safe: string }>(
  'partner-branding.json',
)

const serve = (page: Page) =>
  mockDevnetRpc(page, {
    simulationError: null,
    accounts: {
      [CONFIG_ADDRESS]: { owner: DBC_PROGRAM, base64: config.base64 },
      [branding.address]: { owner: DBC_PROGRAM, base64: branding.safe },
    },
  })

const openReport = (page: Page, address: string) =>
  page.goto(`/config/${address}?network=devnet`)

test.describe('config report', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://fair.example/**', (route) =>
      route.fulfill({ status: 404 }),
    )
  })

  test('reads a config without a wallet: identity, risks, terms, real and simulated launches kept apart', async ({
    page,
  }) => {
    await serve(page)
    await openReport(page, CONFIG_ADDRESS)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Fair Launches',
    )
    await expect(page.locator('.launchpad-identity')).toContainText(
      'not verified by this site',
    )
    await expect(page.locator('.launchpad-identity')).toContainText(FEE_WALLET)
    await expect(
      page.getByRole('heading', { name: 'Risks the terms leave open' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Terms', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('Read from chain', { exact: true }),
    ).toBeVisible()
    await expect(page.locator('.real-launches')).toContainText(
      'No pools have been launched',
    )
    await expect(
      page.getByRole('heading', { name: 'Simulated: a typical launch' }),
    ).toBeVisible()
    await expect(page.locator('.comparison-table tbody tr')).toHaveCount(1)
    // A report, not a launch form: nothing to connect or sign.
    await expect(page.getByRole('button', { name: /connect/i })).toHaveCount(0)
  })

  test('downloads the same report as JSON', async ({ page }) => {
    await serve(page)
    await openReport(page, CONFIG_ADDRESS)
    await expect(page.locator('.real-launches')).toContainText(
      'No pools have been launched',
    )
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download as JSON' }).click(),
    ])
    expect(download.suggestedFilename()).toBe(
      `dbc-config-report-devnet-${CONFIG_ADDRESS}.json`,
    )
    const path = await download.path()
    const report: {
      configAddress: string
      branding: { name: string; verified: boolean }
      risks: unknown[]
      real: { read: boolean }
      simulated: { situation: string }
    } = JSON.parse(readFileSync(path, 'utf8'))
    expect(report.configAddress).toBe(CONFIG_ADDRESS)
    expect(report.branding).toMatchObject({
      name: 'Fair Launches',
      verified: false,
    })
    expect(report.real.read).toBe(false)
    expect(report.simulated.situation).toBe('typical')
    await expect(page.locator('.report-view__risk')).toHaveCount(
      report.risks.length,
    )
  })

  test('links to and from the launch page', async ({ page }) => {
    await serve(page)
    await page.goto(`/launch/${CONFIG_ADDRESS}?network=devnet`)
    await page
      .getByRole('link', { name: 'Read the full report on this config' })
      .click()
    await expect(page).toHaveURL(
      new RegExp(`/config/${CONFIG_ADDRESS}\\?network=devnet$`),
    )
    await page.getByRole('link', { name: 'Open the launch page' }).click()
    await expect(page).toHaveURL(
      new RegExp(`/launch/${CONFIG_ADDRESS}\\?network=devnet$`),
    )
  })

  test('says why an address cannot be reported on', async ({ page }) => {
    await serve(page)
    await openReport(page, UNKNOWN_ADDRESS)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'This config cannot be reported on',
    )
    await expect(page.getByRole('alert')).toBeVisible()
  })
})
