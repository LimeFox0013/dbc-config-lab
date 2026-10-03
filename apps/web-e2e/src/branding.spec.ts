import { expect, test } from '@playwright/test'
import { FAKE_WALLET_NAME } from './fixtures/constants'
import { mockDevnetRpc } from './fixtures/devnet-rpc'
import { installFakeWallet } from './fixtures/fake-wallet'

test.describe('publish launchpad branding', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeWallet(page)
  })

  test('checks the name and links, then dry-runs the write before the wallet signs', async ({
    page,
  }) => {
    const methods = await mockDevnetRpc(page, { simulationError: null })
    await page.goto('/')
    await page
      .getByRole('button', { name: `Connect ${FAKE_WALLET_NAME}` })
      .click()
    const branding = page.locator('.branding-section')
    await branding
      .getByRole('textbox', { name: 'Launchpad name' })
      .fill('Fair Launches')
    await branding
      .getByRole('textbox', { name: 'Logo image URL (https, optional)' })
      .fill('http://fair.example/logo.png')
    await expect(branding.getByRole('alert')).toHaveText(
      'The logo must be an https:// image address.',
    )
    const prepare = branding.getByRole('button', { name: 'Check and prepare' })
    await expect(prepare).toBeDisabled()

    await branding
      .getByRole('textbox', { name: 'Logo image URL (https, optional)' })
      .fill('https://fair.example/logo.png')
    await prepare.click()
    await expect(
      branding.getByRole('button', { name: 'Sign and send in wallet' }),
    ).toBeVisible()
    expect(methods).toContain('simulateTransaction')
  })
})
