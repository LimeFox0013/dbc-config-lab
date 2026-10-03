import { expect, test } from '@playwright/test'
import { mockDevnetRpc } from './fixtures/devnet-rpc'
import { FAKE_WALLET_ADDRESS } from './fixtures/constants'

test.describe('operator dashboard', () => {
  test('watches a fee wallet read-only and says when it collects for no config', async ({
    page,
  }) => {
    await mockDevnetRpc(page, { simulationError: null })
    await page.goto('/')
    const panel = page.locator('.operator-dashboard')
    await panel.locator('summary').click()
    await expect(panel).toContainText('nothing is signed here')
    await panel
      .getByRole('combobox', { name: 'Network' })
      .selectOption('devnet')
    const address = panel.getByRole('textbox', { name: 'Fee wallet address' })

    await address.fill('not an address')
    await panel.getByRole('button', { name: 'Watch' }).click()
    await expect(panel.getByRole('status')).toContainText(
      'That is not a Solana address.',
    )

    await address.fill(FAKE_WALLET_ADDRESS)
    await panel.getByRole('button', { name: 'Watch' }).click()
    await expect(panel.getByRole('status')).toContainText(
      'not the fee claimer of any DBC config on this network',
    )
  })
})
