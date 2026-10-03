import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const panel = (page: Page) => page.locator('.clone-panel')
const comparison = (page: Page) => page.locator('.comparison-table tbody tr')

/** Brings a real launchpad config into the comparison from the economics table. */
const compareLaunchpad = async (page: Page) => {
  const economics = page.locator('.launchpad-economics')
  await economics.locator('summary').click()
  await economics
    .locator('tbody tr')
    .getByRole('button', { name: 'Compare' })
    .and(page.locator(':enabled'))
    .first()
    .click()
}

/** Locks all graduation liquidity, half each, which every current config must allow. */
const lockAllLiquidity = async (page: Page) => {
  const shares = {
    'Your liquidity, unlocked (%)': '0',
    'Your liquidity, locked (%)': '50',
    'Creator liquidity, unlocked (%)': '0',
    'Creator liquidity, locked (%)': '50',
  }
  for (const [name, value] of Object.entries(shares))
    await panel(page).getByRole('spinbutton', { name }).fill(value)
}

test.describe('clone a launchpad config', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('asks for a real config first', async ({ page }) => {
    await expect(panel(page)).toContainText(
      'Add a real config to the comparison first',
    )
  })

  test('adds a clone next to the original, deployable below', async ({
    page,
  }) => {
    await compareLaunchpad(page)
    await expect(comparison(page)).toHaveCount(6)
    await expect(panel(page)).toContainText(
      /An exact copy|would reject an exact copy today/,
    )
    await lockAllLiquidity(page)
    await expect(panel(page)).toContainText('Adjusted terms pass')
    await panel(page)
      .getByRole('button', { name: 'Add clone to comparison' })
      .click()
    await expect(comparison(page)).toHaveCount(7)
    await expect(
      page.locator('.deploy-panel').getByRole('combobox', { name: 'Config' }),
    ).toContainText('Clone of')
  })

  test('checks adjusted terms before they can be added', async ({ page }) => {
    await compareLaunchpad(page)
    await lockAllLiquidity(page)
    const creatorShare = panel(page).getByRole('spinbutton', {
      name: "Creator's share of trading fees (%)",
    })
    await creatorShare.fill('101')
    await expect(panel(page).getByRole('alert')).toBeVisible()
    await expect(
      panel(page).getByRole('button', { name: 'Add clone to comparison' }),
    ).toBeDisabled()
    await creatorShare.fill('30')
    await expect(panel(page)).toContainText('Adjusted terms pass')
  })
})
