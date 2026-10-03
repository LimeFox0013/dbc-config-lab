import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { FAKE_WALLET_NAME } from './fixtures/constants'
import { mockDevnetRpc } from './fixtures/devnet-rpc'
import { installFakeWallet } from './fixtures/fake-wallet'

/** A valid address that is not the fake wallet's. */
const AUTHOR = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'

const editor = (page: Page) => page.locator('.config-editor')

test.describe('preset royalty', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeWallet(page)
  })

  test('refuses a royalty that cannot be paid, with the reason', async ({
    page,
  }) => {
    await page.goto('/')
    await editor(page)
      .getByRole('textbox', { name: 'Author wallet' })
      .fill('not-an-address')
    await expect(editor(page).getByRole('alert')).toContainText(
      'the author is not a valid address',
    )
    await expect(
      editor(page).getByRole('button', { name: 'Add to comparison' }),
    ).toBeDisabled()
  })

  test('a preset with a royalty shows the split and the vault-held liquidity before signing', async ({
    page,
  }) => {
    await mockDevnetRpc(page, { simulationError: null })
    await page.goto('/')
    await editor(page)
      .getByRole('textbox', { name: 'Author wallet' })
      .fill(AUTHOR)
    await editor(page)
      .getByRole('spinbutton', { name: "Author's share of fees (%)" })
      .fill('10')
    await editor(page)
      .getByRole('textbox', { name: 'Name' })
      .fill('Royalty preset')
    await editor(page)
      .getByRole('button', { name: 'Add to comparison' })
      .click()

    await page
      .getByRole('button', { name: `Connect ${FAKE_WALLET_NAME}` })
      .click()
    await page.getByRole('combobox', { name: 'Config' }).selectOption('custom')
    await page.getByRole('button', { name: 'Prepare transaction' }).click()
    const summary = page.locator('.deploy-panel__summary')
    await expect(summary).toContainText(
      `You 90% · preset author 10% (${AUTHOR})`,
    )
    await expect(summary).toContainText('cannot be withdrawn')
  })
})
