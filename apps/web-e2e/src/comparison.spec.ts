import { expect, test } from '@playwright/test'

test.describe('comparison', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('shows every built-in config with its intent and outcome', async ({
    page,
  }) => {
    const rows = page.locator('tbody tr')
    await expect(rows).toHaveCount(4)
    await expect(rows.nth(0)).toContainText('Flat 1%')
    await expect(rows.nth(0)).toContainText('Baseline')
  })

  test('snipers profit under a flat fee and lose under the sniper shield', async ({
    page,
  }) => {
    const sniperProfit = (name: string) =>
      page
        .getByRole('row', { name: new RegExp(name) })
        .getByRole('cell')
        .first()
    await expect(sniperProfit('Flat 1%')).toHaveText(/^\+/)
    await expect(sniperProfit('Sniper shield')).toHaveText(/^-/)
  })

  test('a different seed changes the outcome', async ({ page }) => {
    const flatHuman = page
      .getByRole('row', { name: /Flat 1%/ })
      .getByRole('cell')
      .nth(2)
    const before = await flatHuman.textContent()
    await page.getByRole('spinbutton', { name: 'Seed' }).fill('7')
    await page.getByRole('spinbutton', { name: 'Seed' }).press('Enter')
    await expect(flatHuman).not.toHaveText(before ?? '')
  })

  test('caps an oversized trader count instead of freezing the page', async ({
    page,
  }) => {
    const snipers = page.getByRole('spinbutton', { name: 'Snipers' })
    await snipers.fill('999999999')
    await snipers.press('Enter')
    await expect(snipers).toHaveValue('500')
    await expect(page.locator('tbody tr')).toHaveCount(4)
  })

  test('shows patient-bot profit next to sniper profit', async ({ page }) => {
    await expect(
      page.getByRole('columnheader', { name: 'Patient-bot profit' }),
    ).toBeVisible()
  })

  test('a hype launch shows fees earned after graduation', async ({ page }) => {
    await page
      .getByRole('combobox', { name: 'Launch situation' })
      .selectOption('hype')
    await expect(page.getByRole('row', { name: /Flat 1%/ })).toContainText(
      /after graduation/,
    )
  })

  test('a hype launch graduates and says so', async ({ page }) => {
    await page
      .getByRole('combobox', { name: 'Launch situation' })
      .selectOption('hype')
    await expect(page.getByText('A crowded launch')).toBeVisible()
    await expect(
      page
        .getByRole('row', { name: /Flat 1%/ })
        .getByRole('cell')
        .last(),
    ).toHaveText(/^Yes, after \d+s$/)
  })

  test('editing a count away from a preset marks the scenario as custom', async ({
    page,
  }) => {
    const humans = page.getByRole('spinbutton', { name: 'Human buyers' })
    await humans.fill('61')
    await humans.press('Enter')
    await expect(
      page.getByRole('combobox', { name: 'Launch situation' }),
    ).toHaveValue('custom')
  })
})
