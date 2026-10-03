import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const catalog = (page: Page) => page.locator('.preset-catalog')

test.describe('preset catalogue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await catalog(page).locator('summary').click()
  })

  test('shows built-in presets and real launchpads with their record and simulated outcome', async ({
    page,
  }) => {
    await expect(catalog(page)).toContainText('Sniper shield')
    await expect(catalog(page)).toContainText(
      /real launches graduated \(read \d{4}-\d{2}-\d{2}\)/,
    )
    await expect(
      catalog(page).locator('.preset-catalog__outcome').first(),
    ).toContainText('Here: bots')
  })

  test('opens a copy of a built-in preset in the editor', async ({ page }) => {
    await catalog(page)
      .locator('.preset-catalog__entry', { hasText: 'Long tax' })
      .getByRole('button', { name: 'Edit a copy' })
      .click()
    await expect(
      page
        .locator('.config-editor')
        .getByRole('combobox', { name: 'Start from' }),
    ).toHaveValue('long-tax')
  })

  test('adds a launchpad config to the comparison', async ({ page }) => {
    await expect(page.locator('tbody tr')).toHaveCount(5)
    await catalog(page)
      .locator('.preset-catalog__entry', { hasText: 'Launchpad config' })
      .first()
      .getByRole('button', { name: 'Compare' })
      .click()
    await expect(page.locator('tbody tr')).toHaveCount(6)
  })
})
