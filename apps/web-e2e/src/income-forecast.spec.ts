import { expect, test } from '@playwright/test'

test.describe('income forecast', () => {
  test('gives what comparable launchpads earned, or says why it cannot, never as a promise', async ({
    page,
  }) => {
    await page.goto('/')
    const panel = page.locator('.income-forecast')
    await panel.locator('summary').click()
    await expect(panel).toContainText('Comparable terms: priced in SOL')
    await expect(panel).toContainText(/SOL from 100 launches|so none is given/)
    await expect(panel).toContainText('not a promise')
    await expect(panel).toContainText(
      /SOL after graduation|could not be measured|so none is given/,
    )
    await panel.getByRole('spinbutton', { name: 'Launches' }).fill('250')
    await expect(panel).toContainText(/SOL from 250 launches|so none is given/)
  })
})
