import { expect, test } from '@playwright/test'

test.describe('sharing', () => {
  test('a copied share link reopens the config in a fresh page', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: baseURL,
    })
    await page.goto('/')
    const editor = page.locator('.config-editor')
    const threshold = editor.getByRole('spinbutton', { name: /Graduates at/ })
    await threshold.fill('60')
    await threshold.press('Enter')
    await editor.getByRole('textbox', { name: 'Name' }).fill('Sixty')
    await editor.getByRole('button', { name: 'Copy share link' }).click()
    await expect(editor.getByText('Link copied')).toBeVisible()

    const link = await page.evaluate(() => navigator.clipboard.readText())
    expect(new URL(link).hash).toMatch(/^#config=/)

    const fresh = await context.newPage()
    await fresh.goto(link)
    await expect(fresh.locator('tbody tr').first()).toContainText(
      'Shared: Sixty',
    )
    await expect(
      fresh.locator('.deploy-panel').getByRole('combobox', { name: 'Config' }),
    ).toContainText('Shared: Sixty')
  })

  test('a damaged link is refused with a notice, and the page still works', async ({
    page,
  }) => {
    await page.goto('/#config=not-a-real-config')
    await expect(page.getByRole('alert')).toContainText('damaged')
    await expect(page.locator('tbody tr')).toHaveCount(4)
  })

  test('shows ready-to-run SDK code for the config', async ({ page }) => {
    await page.goto('/')
    const editor = page.locator('.config-editor')
    await editor.getByRole('button', { name: 'Show code' }).click()
    await expect(editor.locator('pre')).toContainText('buildCurve(')
    await expect(editor.locator('pre')).toContainText(
      'client.partner.createConfig',
    )
    await editor
      .getByRole('combobox', { name: 'Curve shape' })
      .selectOption('1')
    await expect(editor.locator('pre')).toContainText(
      'buildCurveWithMarketCap(',
    )
  })
})
