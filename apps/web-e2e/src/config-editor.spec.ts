import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test.describe('config editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  const editor = (page: Page) => page.locator('.config-editor')

  test('starts from a preset and says Meteora would accept it', async ({
    page,
  }) => {
    await expect(editor(page).getByRole('status')).toHaveText(
      'Meteora would accept this config.',
    )
    await expect(
      editor(page).getByRole('button', { name: 'Add to comparison' }),
    ).toBeEnabled()
  })

  test('shows the program’s reason and blocks adding when the LP split is wrong', async ({
    page,
  }) => {
    const partner = editor(page).getByRole('spinbutton', {
      name: /Partner LP \(/,
    })
    await partner.fill('10')
    await partner.press('Enter')
    await expect(editor(page).getByRole('status')).toContainText(
      'Meteora would reject this config',
    )
    await expect(
      editor(page).getByRole('button', { name: 'Add to comparison' }),
    ).toBeDisabled()
  })

  test('prices the launch in USDC at the reference rate and warns below the keepers’ minimum', async ({
    page,
  }) => {
    await editor(page)
      .getByRole('combobox', { name: 'Priced in' })
      .selectOption({ label: 'USDC' })
    const threshold = editor(page).getByRole('spinbutton', {
      name: 'Graduates at (USDC)',
    })
    await expect(threshold).toHaveValue('12750')
    await expect(editor(page).getByText(/below the 750 USDC/)).toHaveCount(0)

    await threshold.fill('700')
    await threshold.press('Enter')
    await expect(editor(page).getByText(/below the 750 USDC/)).toBeVisible()
  })

  test('a custom graduation pool can compound part of its fees into its liquidity', async ({
    page,
  }) => {
    await editor(page)
      .getByRole('combobox', { name: 'Graduation pool fee' })
      .selectOption({ label: 'Custom' })
    await editor(page)
      .getByRole('combobox', { name: 'Graduation pool fees' })
      .selectOption({ label: 'Partly compounded into the pool' })
    await expect(
      editor(page).getByRole('spinbutton', {
        name: /Share of LP fees compounded/,
      }),
    ).toHaveValue('50')
    await expect(
      editor(page).getByText('Meteora would accept this config.'),
    ).toBeVisible()
  })

  test('a falling fee reveals its opening fee and window', async ({ page }) => {
    await expect(
      editor(page).getByRole('spinbutton', { name: /Falls over/ }),
    ).toHaveCount(0)
    await editor(page)
      .getByRole('combobox', { name: 'Fee over time' })
      .selectOption('1')
    await expect(
      editor(page).getByRole('spinbutton', { name: /Opening fee/ }),
    ).toHaveValue('50')
    await expect(
      editor(page).getByRole('spinbutton', { name: /Falls over/ }),
    ).toHaveValue('10')
  })

  test('a config with the volatility fee is accepted and simulated', async ({
    page,
  }) => {
    await editor(page)
      .getByRole('combobox', { name: 'Volatility fee' })
      .selectOption('1')
    await expect(editor(page).getByRole('status')).toHaveText(
      'Meteora would accept this config.',
    )
    await editor(page)
      .getByRole('textbox', { name: 'Name' })
      .fill('Volatility fee')
    await editor(page)
      .getByRole('button', { name: 'Add to comparison' })
      .click()

    const row = page.locator('tbody tr').first()
    await expect(row).toContainText('Volatility fee')
    await expect(row.getByRole('cell').first()).toHaveText(/^[+−-]?\d/)
  })

  test('unlocked liquidity shows what pulling it after graduation takes', async ({
    page,
  }) => {
    const percent = (name: RegExp) =>
      editor(page).getByRole('spinbutton', { name })
    const set = async (name: RegExp, value: string) => {
      await percent(name).fill(value)
      await percent(name).press('Enter')
    }
    await set(/^Creator LP, locked \(/, '10')
    await set(/^Creator LP \(/, '40')
    await expect(editor(page).getByRole('status')).toHaveText(
      'Meteora would accept this config.',
    )
    await editor(page)
      .getByRole('textbox', { name: 'Name' })
      .fill('Unlocked LP')
    await editor(page)
      .getByRole('button', { name: 'Add to comparison' })
      .click()

    await page
      .getByRole('combobox', { name: 'Launch situation' })
      .selectOption('hype')
    await page
      .getByRole('checkbox', {
        name: 'Unlocked liquidity is pulled right after graduation',
      })
      .check()
    const row = page.getByRole('row', { name: /^Unlocked LP/ })
    await expect(row).toContainText('40% of graduation liquidity can be pulled')
    await expect(row).toContainText(/\d+\.\d{2} SOL of liquidity pulled/)
    await expect(page.getByRole('row', { name: /^Flat 1%/ })).not.toContainText(
      'liquidity',
    )
  })

  test('an added config joins the comparison and the deploy picker without changing its source', async ({
    page,
  }) => {
    const flatRow = page.getByRole('row', { name: /^Flat 1%/ })
    const before = await flatRow.textContent()
    const threshold = editor(page).getByRole('spinbutton', {
      name: /Graduates at/,
    })
    await threshold.fill('40')
    await threshold.press('Enter')
    await editor(page)
      .getByRole('textbox', { name: 'Name' })
      .fill('Quick graduation')
    await editor(page)
      .getByRole('button', { name: 'Add to comparison' })
      .click()

    await expect(page.locator('tbody tr').first()).toContainText(
      'Quick graduation',
    )
    await expect(
      page.locator('.deploy-panel').getByRole('combobox', { name: 'Config' }),
    ).toContainText('Quick graduation')
    await expect(flatRow).toHaveText(before ?? '')
  })
})
