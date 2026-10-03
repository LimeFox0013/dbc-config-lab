import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DBC_PROGRAM,
  FAKE_WALLET_NAME,
  TOKEN_PROGRAM,
  WRAPPED_SOL_MINT,
} from './fixtures/constants'
import { mockDevnetRpc } from './fixtures/devnet-rpc'
import { installFakeWallet } from './fixtures/fake-wallet'

const CONFIG_ADDRESS = '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM'

/** The built-in "Flat 1%" config's account bytes, quote mint wrapped SOL. */
const flatPoolConfig: { base64: string } = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'flat-pool-config.json'), 'utf8'),
)

/** An initialized SPL mint with 9 decimals: the layout's decimals and initialized bytes set. */
const MINT_ACCOUNT_BYTES = 82
const mintAccount = (): string => {
  const data = Buffer.alloc(MINT_ACCOUNT_BYTES)
  data[44] = 9
  data[45] = 1
  return data.toString('base64')
}

const launch = (page: Page) => page.locator('.pool-launch')

const fill = async (page: Page, label: string, value: string) =>
  launch(page).getByRole('textbox', { name: label }).fill(value)

test.describe('launch a token', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeWallet(page)
  })

  test('says what is wrong with the token details and keeps prepare disabled', async ({
    page,
  }) => {
    await page.goto('/')
    await page
      .getByRole('button', { name: `Connect ${FAKE_WALLET_NAME}` })
      .click()
    await fill(page, 'Config address', CONFIG_ADDRESS)
    await fill(page, 'Token name', 'Lab Token')
    await expect(launch(page)).toContainText('Give the token a symbol.')
    await expect(
      launch(page).getByRole('button', { name: 'Prepare launch' }),
    ).toBeDisabled()
  })

  test('prepares a launch with a first buy and shows what will be signed', async ({
    page,
  }) => {
    const methods = await mockDevnetRpc(page, {
      simulationError: null,
      accounts: {
        [CONFIG_ADDRESS]: { owner: DBC_PROGRAM, base64: flatPoolConfig.base64 },
        [WRAPPED_SOL_MINT]: { owner: TOKEN_PROGRAM, base64: mintAccount() },
      },
    })
    await page.goto('/')
    await page
      .getByRole('button', { name: `Connect ${FAKE_WALLET_NAME}` })
      .click()
    await fill(page, 'Config address', CONFIG_ADDRESS)
    await fill(page, 'Token name', 'Lab Token')
    await fill(page, 'Symbol', 'LAB')
    await launch(page)
      .getByRole('spinbutton', { name: /First buy/ })
      .fill('1')
    await launch(page).getByRole('button', { name: 'Prepare launch' }).click()

    const summary = launch(page).locator('.pool-launch__summary')
    await expect(summary).toContainText('Lab Token (LAB)')
    await expect(summary).toContainText(CONFIG_ADDRESS)
    await expect(summary).toContainText(/1 SOL for about [\d,]+ tokens/)
    await expect(summary).toContainText('1% fee')
    // The config's terms bind the creator too, so they are shown before signing.
    await expect(summary).toContainText('Pool creation fee')
    await expect(summary).toContainText('Creator’s share of trading fees')
    await expect(
      launch(page).getByRole('button', { name: 'Sign and send in wallet' }),
    ).toBeVisible()
    expect(methods).toContain('simulateTransaction')

    // Changing the token discards what was prepared.
    await fill(page, 'Symbol', 'LAB2')
    await expect(summary).toHaveCount(0)
  })

  test('finds the connected wallet’s earnings — here, none on this network', async ({
    page,
  }) => {
    await mockDevnetRpc(page, { simulationError: null })
    await page.goto('/')
    const earnings = page.locator('.earnings-section')
    await expect(
      earnings.getByRole('button', { name: 'Find my earnings' }),
    ).toBeDisabled()
    await page
      .getByRole('button', { name: `Connect ${FAKE_WALLET_NAME}` })
      .click()
    await earnings.getByRole('button', { name: 'Find my earnings' }).click()
    await expect(earnings).toContainText('Nothing to claim on this network.')
  })
})
