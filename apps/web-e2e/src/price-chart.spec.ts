import { expect, test } from '@playwright/test'

test.describe('price chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('draws one line per simulated config with a text summary of each', async ({
    page,
  }) => {
    const chart = page.locator('.price-chart')
    await expect(
      chart.getByRole('img', { name: /multiple of its opening price/ }),
    ).toBeVisible()
    await expect(chart.locator('polyline')).toHaveCount(4)
    await expect(chart.getByRole('listitem')).toHaveCount(4)
    await expect(chart.getByRole('listitem').first()).toContainText(
      'did not graduate',
    )
  })

  test('marks graduation in a hype launch', async ({ page }) => {
    await page
      .getByRole('combobox', { name: 'Launch situation' })
      .selectOption('hype')
    const chart = page.locator('.price-chart')
    await expect(chart.locator('circle')).toHaveCount(4)
    await expect(chart.getByRole('listitem').first()).toContainText(
      /graduated after \d+s/,
    )
  })
})
