import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const editor = (page: Page) => page.locator('.config-editor')

/** Sets an editor field by its label and commits it. */
const setField = async (page: Page, name: RegExp, value: string) => {
  const field = editor(page).getByRole('spinbutton', { name })
  await field.fill(value)
  await field.press('Enter')
}

test.describe('creator vesting', () => {
  test('a config that vests tokens to the creator shows what selling them does to buyers', async ({
    page,
  }) => {
    await page.goto('/')
    await setField(page, /Tokens locked for the creator/, '100000000')
    await setField(page, /Unlocked at the cliff/, '10000000')
    await setField(page, /Cliff after graduation/, '2592000')
    await setField(page, /Then unlocking in periods/, '12')
    await setField(page, /Over \(total\)/, '31536000')
    await expect(editor(page).getByRole('status')).toHaveText(
      'Meteora would accept this config.',
    )
    await editor(page)
      .getByRole('textbox', { name: 'Name' })
      .fill('Vesting test')
    await editor(page)
      .getByRole('button', { name: 'Add to comparison' })
      .click()

    await page
      .getByRole('combobox', { name: 'Launch situation' })
      .selectOption('hype')
    await page
      .getByRole('checkbox', {
        name: 'The creator sells their vested tokens after graduation',
      })
      .check()
    await expect(page.locator('.scenario-controls')).toContainText(
      'Nobody else trades between unlocks here',
    )
    const row = page
      .locator('.comparison-table tbody tr')
      .filter({ hasText: 'Vesting test' })
    await expect(row).toContainText(/SOL from vested tokens sold/)
    // Built-in presets vest nothing, so nothing is sold for them.
    await expect(
      page.locator('.comparison-table tbody tr').filter({ hasText: 'Flat 1%' }),
    ).not.toContainText('vested tokens sold')
  })
})
