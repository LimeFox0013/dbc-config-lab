import { expect, test } from '@playwright/test'

test.describe('recommender', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('proposes three simulated configs measured against the flat fee', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Find best configs' }).click()
    const proposals = page.locator('.recommender-panel__proposal')
    await expect(proposals).toHaveCount(3)
    await expect(proposals.first()).toContainText('vs flat fee')
    await expect(proposals.first()).toContainText(
      'average of 10 simulated launches',
    )
  })

  test('a chosen proposal joins the comparison and the deploy picker', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Find best configs' }).click()
    await page.getByRole('button', { name: 'Use this config' }).first().click()
    await expect(page.locator('tbody tr')).toHaveCount(6)
    await expect(page.locator('tbody tr').first()).toContainText('Recommended:')
    await expect(
      page.getByRole('combobox', { name: 'Config' }).locator('option').first(),
    ).toContainText('Recommended:')
  })

  test('says when the proposal is identical to a built-in preset', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Find best configs' }).click()
    await page.getByRole('button', { name: 'Use this config' }).first().click()
    await expect(page.locator('tbody tr').first()).toContainText(
      'Same config as the built-in',
    )
  })

  test('clears proposals when the scenario changes', async ({ page }) => {
    await page.getByRole('button', { name: 'Find best configs' }).click()
    await expect(page.locator('.recommender-panel__proposal')).toHaveCount(3)
    await page.getByRole('spinbutton', { name: 'Seed' }).fill('9')
    await page.getByRole('spinbutton', { name: 'Seed' }).press('Enter')
    await expect(page.locator('.recommender-panel__proposal')).toHaveCount(0)
  })

  test('keeps the detailed weights folded away until asked', async ({
    page,
  }) => {
    const slider = page.getByRole('slider', { name: /Price stability/ })
    await expect(slider).toBeHidden()
    await page.getByText('Adjust weights').click()
    await expect(slider).toBeVisible()
  })

  test('graduate fast says graduation cannot rank when nothing graduates', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Graduate fast' }).click()
    await page.getByRole('button', { name: 'Find best configs' }).click()
    await expect(
      page.locator('.recommender-panel').getByRole('status'),
    ).toContainText('Graduating, and fast')
  })

  test('graduate fast ranks by graduation in a hype launch', async ({
    page,
  }) => {
    await page
      .getByRole('combobox', { name: 'Launch situation' })
      .selectOption('hype')
    await page.getByRole('button', { name: 'Graduate fast' }).click()
    await page.getByRole('button', { name: 'Find best configs' }).click()
    await expect(
      page.locator('.recommender-panel__proposal').first(),
    ).toContainText('graduates in 100% of launches')
  })

  test('raise the most admits every schedule raises the same once all of them graduate', async ({
    page,
  }) => {
    await page
      .getByRole('combobox', { name: 'Launch situation' })
      .selectOption('hype')
    await page.getByRole('button', { name: 'Raise the most' }).click()
    await page.getByRole('button', { name: 'Find best configs' }).click()
    await expect(
      page.locator('.recommender-panel').getByRole('status'),
    ).toContainText('SOL raised')
  })

  test('curve search lets graduate fast pick a curve that graduates', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Graduate fast' }).click()
    await page
      .getByRole('checkbox', { name: /Also try other curve shapes/ })
      .check()
    await page.getByRole('button', { name: 'Find best configs' }).click()
    const first = page.locator('.recommender-panel__proposal').first()
    await expect(first).toContainText(/curve/, { timeout: 15_000 })
    await expect(first).toContainText(/graduates in \d+% of launches/)
  })
})
