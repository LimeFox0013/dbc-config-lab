import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FAKE_WALLET_ADDRESS, FAKE_WALLET_NAME } from './fixtures/constants'
import { mockDevnetRpc } from './fixtures/devnet-rpc'
import { installFakeWallet } from './fixtures/fake-wallet'

test.describe('deploy without a wallet', () => {
  test('explains that a wallet is needed and keeps prepare disabled', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByText('No Solana wallet found')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Prepare transaction' }),
    ).toBeDisabled()
  })
})

test.describe('deploy with a wallet', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeWallet(page)
  })

  test('mainnet needs an explicit acknowledgement before preparing', async ({
    page,
  }) => {
    await page.goto('/')
    await page
      .locator('.deploy-panel')
      .getByRole('combobox', { name: 'Network' })
      .selectOption('mainnet-beta')
    await page
      .getByRole('button', { name: `Connect ${FAKE_WALLET_NAME}` })
      .click()
    const prepare = page.getByRole('button', { name: 'Prepare transaction' })
    await expect(prepare).toBeDisabled()
    await page
      .locator('.deploy-panel')
      .getByRole('checkbox', {
        name: /on Solana mainnet everything signed here is real/,
      })
      .check()
    await expect(prepare).toBeEnabled()
  })

  test('prepares on devnet and shows what will be signed', async ({ page }) => {
    const methods = await mockDevnetRpc(page, { simulationError: null })
    await page.goto('/')
    await page
      .getByRole('button', { name: `Connect ${FAKE_WALLET_NAME}` })
      .click()
    await expect(page.getByText(`Connected: ${FAKE_WALLET_NAME}`)).toBeVisible()
    await page.getByRole('button', { name: 'Prepare transaction' }).click()

    const summary = page.locator('.deploy-panel__summary')
    await expect(summary).toContainText('devnet')
    await expect(summary).toContainText(FAKE_WALLET_ADDRESS)
    await expect(
      page.getByRole('button', { name: 'Sign and send in wallet' }),
    ).toBeVisible()
    // Connecting reads whether the wallet has published launchpad branding.
    expect(methods).toEqual([
      'getAccountInfo',
      'getLatestBlockhash',
      'simulateTransaction',
    ])
  })

  test('a failing dry run is reported and nothing is offered for signing', async ({
    page,
  }) => {
    await mockDevnetRpc(page, { simulationError: 'InsufficientFundsForFee' })
    await page.goto('/')
    await page
      .getByRole('button', { name: `Connect ${FAKE_WALLET_NAME}` })
      .click()
    await page.getByRole('button', { name: 'Prepare transaction' }).click()

    await expect(page.getByRole('alert')).toContainText('Dry run failed')
    await expect(
      page.getByRole('button', { name: 'Sign and send in wallet' }),
    ).toHaveCount(0)
  })

  test('changing the config discards the prepared transaction', async ({
    page,
  }) => {
    await mockDevnetRpc(page, { simulationError: null })
    await page.goto('/')
    await page
      .getByRole('button', { name: `Connect ${FAKE_WALLET_NAME}` })
      .click()
    await page.getByRole('button', { name: 'Prepare transaction' }).click()
    await expect(page.locator('.deploy-panel__summary')).toBeVisible()

    await page
      .getByRole('combobox', { name: 'Config' })
      .selectOption('sniper-shield')
    await expect(page.locator('.deploy-panel__summary')).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Sign and send in wallet' }),
    ).toHaveCount(0)
  })

  test('signs on the chosen chain and links the deployed config', async ({
    page,
  }) => {
    await mockDevnetRpc(page, { simulationError: null })
    await page.goto('/')
    await page
      .getByRole('button', { name: `Connect ${FAKE_WALLET_NAME}` })
      .click()
    await page.getByRole('button', { name: 'Prepare transaction' }).click()
    await page.getByRole('button', { name: 'Sign and send in wallet' }).click()

    await expect(page.getByText('Config deployed.')).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'View config' }),
    ).toHaveAttribute('href', /cluster=devnet/)
    await expect(
      page.getByRole('link', { name: 'View transaction' }),
    ).toHaveAttribute('rel', 'noopener noreferrer')

    const chains = await page.evaluate(() => {
      const requests: unknown = Reflect.get(window, '__fakeWalletRequests')
      return Array.isArray(requests)
        ? requests.map((r) =>
            typeof r === 'object' && r !== null && 'chain' in r
              ? r.chain
              : null,
          )
        : []
    })
    expect(chains).toEqual(['solana:devnet'])
  })

  test('a shared config is never preselected, and its summary shows every earning and control setting', async ({
    page,
  }) => {
    const shared = Buffer.from(
      readFileSync(
        join(__dirname, 'fixtures', 'creator-fee-shared-config.json'),
        'utf8',
      ),
    ).toString('base64url')
    await mockDevnetRpc(page, { simulationError: null })
    await page.goto(`/#config=${shared}`)
    const panel = page.locator('.deploy-panel')
    const config = panel.getByRole('combobox', { name: 'Config' })
    await expect(config).not.toHaveValue('shared')

    await config.selectOption('shared')
    await page
      .getByRole('button', { name: `Connect ${FAKE_WALLET_NAME}` })
      .click()
    await page.getByRole('button', { name: 'Prepare transaction' }).click()

    const summary = page.locator('.deploy-panel__summary')
    await expect(summary).toContainText('Creator can update metadata')
    await expect(summary).toContainText('Creator’s share of trading fees100%')
    await expect(summary).toContainText('Launchpad 0% + 50% locked')
    await expect(summary).toContainText('Graduation pool volatility feeOff')
    await expect(summary).toContainText(
      'Graduation pool fee as the price risesStays the same',
    )
  })
})
