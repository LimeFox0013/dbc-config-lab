import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DBC_PROGRAM,
  FAKE_WALLET_ADDRESS,
  FAKE_WALLET_NAME,
} from './fixtures/constants'
import { mockDevnetRpc } from './fixtures/devnet-rpc'
import { installFakeWallet } from './fixtures/fake-wallet'

/** A valid address that is not the fake wallet's. */
const SOMEONE_ELSE = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'
const CONFIG_ADDRESS = '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM'

const fixture = (name: string): string =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8')
const shared = Buffer.from(fixture('creator-fee-shared-config.json')).toString(
  'base64url',
)
const poolConfig: { base64: string } = JSON.parse(
  fixture('flat-pool-config.json'),
)

const openHandoff = (page: Page, fields: Record<string, string>) =>
  page.goto(`/act#${new URLSearchParams(fields).toString()}`)

const connect = (page: Page) =>
  page.getByRole('button', { name: `Connect ${FAKE_WALLET_NAME}` }).click()

test.describe('agent hand-off', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeWallet(page)
  })

  test('refuses a link that is not a valid proposed action, with the reason', async ({
    page,
  }) => {
    await openHandoff(page, {
      action: 'deploy',
      network: 'devnet',
      owner: FAKE_WALLET_ADDRESS,
      shared: 'not-a-config',
    })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'This proposed action cannot be shown',
    )
    await expect(page.getByRole('alert')).toContainText(
      'The proposed config is not valid',
    )
  })

  test('only the wallet the agent named can sign', async ({ page }) => {
    await openHandoff(page, {
      action: 'claim',
      network: 'devnet',
      owner: SOMEONE_ELSE,
    })
    await expect(
      page.getByText(`Connect the wallet the agent named: ${SOMEONE_ELSE}.`),
    ).toBeVisible()
    await connect(page)
    await expect(page.getByRole('alert')).toContainText(
      `Only ${SOMEONE_ELSE} can sign this action`,
    )
    await expect(page.locator('.earnings-section')).toHaveCount(0)
  })

  test('a proposed deploy is prepared again and shows the full summary before signing', async ({
    page,
  }) => {
    const methods = await mockDevnetRpc(page, { simulationError: null })
    await openHandoff(page, {
      action: 'deploy',
      network: 'devnet',
      owner: FAKE_WALLET_ADDRESS,
      shared,
    })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Deploy a launch config',
    )
    await connect(page)
    await page.getByRole('button', { name: 'Prepare transaction' }).click()

    const summary = page.locator('.config-deploy__summary')
    await expect(summary).toContainText(FAKE_WALLET_ADDRESS)
    await expect(summary).toContainText('Creator’s share of trading fees100%')
    await expect(
      page.getByRole('button', { name: 'Sign and send in wallet' }),
    ).toBeVisible()
    expect(methods).toContain('simulateTransaction')
  })

  test('a proposed launch arrives filled in, on the named config, locked', async ({
    page,
  }) => {
    await mockDevnetRpc(page, {
      simulationError: null,
      accounts: {
        [CONFIG_ADDRESS]: { owner: DBC_PROGRAM, base64: poolConfig.base64 },
      },
    })
    await openHandoff(page, {
      action: 'launch',
      network: 'devnet',
      owner: FAKE_WALLET_ADDRESS,
      launchpad: CONFIG_ADDRESS,
      name: 'Agent Token',
      symbol: 'AGT',
      uri: '',
      'first-buy': '0.05',
    })
    await connect(page)
    const launch = page.locator('.pool-launch')
    await expect(
      launch.getByRole('textbox', { name: 'Config address' }),
    ).toHaveValue(CONFIG_ADDRESS)
    await expect(
      launch.getByRole('textbox', { name: 'Config address' }),
    ).toHaveAttribute('readonly', '')
    await expect(
      launch.getByRole('textbox', { name: 'Token name' }),
    ).toHaveValue('Agent Token')
    await expect(launch.getByRole('spinbutton')).toHaveValue('0.05')
  })

  test('a mainnet proposal still needs the owner’s own acknowledgement', async ({
    page,
  }) => {
    await openHandoff(page, {
      action: 'deploy',
      network: 'mainnet-beta',
      owner: FAKE_WALLET_ADDRESS,
      shared,
    })
    await connect(page)
    const prepare = page.getByRole('button', { name: 'Prepare transaction' })
    await expect(prepare).toBeDisabled()
    await page
      .getByRole('checkbox', {
        name: /on Solana mainnet everything signed here is real/,
      })
      .check()
    await expect(prepare).toBeEnabled()
  })

  test('a proposed clone is rebuilt from the original read on chain', async ({
    page,
  }) => {
    await mockDevnetRpc(page, {
      simulationError: null,
      accounts: {
        [CONFIG_ADDRESS]: { owner: DBC_PROGRAM, base64: poolConfig.base64 },
      },
    })
    await openHandoff(page, {
      action: 'clone',
      network: 'devnet',
      owner: FAKE_WALLET_ADDRESS,
      source: CONFIG_ADDRESS,
      'source-network': 'devnet',
      adjustments: JSON.stringify({ creatorTradingFeePercentage: 20 }),
    })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Deploy a copy of a launchpad config',
    )
    await connect(page)
    await page.getByRole('button', { name: 'Prepare transaction' }).click()
    const summary = page.locator('.config-deploy__summary')
    await expect(summary).toContainText(FAKE_WALLET_ADDRESS)
    await expect(summary).toContainText('Creator’s share of trading fees20%')
  })
})
