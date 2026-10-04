import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const panel = (page: Page) => page.locator('.launchpad-economics')
const rows = (page: Page) => panel(page).locator('tbody tr')

test.describe('launchpad economics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await panel(page).locator('summary').click()
  })

  test('lists real launchpads with partner income per launch and the read date', async ({
    page,
  }) => {
    await expect(rows(page).first()).toContainText(
      /SOL median · .* SOL top quarter/,
    )
    await expect(panel(page)).toContainText(
      /matching launchpads \(read from mainnet on \d{4}-\d{2}-\d{2}\)/,
    )
  })

  test('says what each launchpad earns after graduation, or why it cannot be read', async ({
    page,
  }) => {
    await expect(panel(page).locator('thead')).toContainText('After graduation')
    await expect(rows(page).first()).toContainText(
      /none — keeps no liquidity|per graduated launch|not measurable — positions moved/,
    )
  })

  test('links every launchpad to its report', async ({ page }) => {
    const report = rows(page).first().getByRole('link', { name: 'Report' })
    await expect(report).toHaveAttribute(
      'href',
      /^\/config\/\w+\?network=mainnet-beta$/,
    )
  })

  test('narrows the list by the terms a builder picks', async ({ page }) => {
    await expect(rows(page).first()).toBeVisible()
    await panel(page)
      .getByRole('combobox', { name: 'Priced in' })
      .selectOption('usdc')
    await expect(panel(page)).toContainText(/Showing \d+ of \d+/)
    const terms = panel(page).locator('.launchpad-economics__terms')
    const count = await terms.count()
    for (let i = 0; i < count; i++)
      await expect(terms.nth(i)).toContainText('USDC')
  })

  test('adds a launchpad config to the comparison', async ({ page }) => {
    const comparison = page.locator('.comparison-table tbody tr')
    await expect(comparison).toHaveCount(5)
    await rows(page)
      .getByRole('button', { name: 'Compare' })
      .and(page.locator(':enabled'))
      .first()
      .click()
    await expect(comparison).toHaveCount(6)
  })
})
