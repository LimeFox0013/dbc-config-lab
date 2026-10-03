import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DBC_PROGRAM, DEVNET_RPC } from './fixtures/constants'
import { mockDevnetRpc } from './fixtures/devnet-rpc'

const CONFIG_ADDRESS = '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM'
const OTHER_PROGRAM = '11111111111111111111111111111111'

const flatPoolConfig: { base64: string } = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'flat-pool-config.json'), 'utf8'),
)

/** Answers getAccountInfo for one address with the given owner and data; counts the reads. */
const mockAccount = async (
  page: Page,
  owner: string,
): Promise<{ reads: number }> => {
  const counter = { reads: 0 }
  await page.route(DEVNET_RPC, async (route: Route) => {
    const body: unknown = route.request().postDataJSON()
    const id =
      typeof body === 'object' && body !== null && 'id' in body ? body.id : 0
    counter.reads++
    const data = Buffer.from(flatPoolConfig.base64, 'base64')
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: {
          context: { slot: 1 },
          value: {
            data: [flatPoolConfig.base64, 'base64'],
            executable: false,
            lamports: 1,
            owner,
            rentEpoch: 0,
            space: data.length,
          },
        },
      }),
    })
  })
  return counter
}

const loader = (page: Page) => page.locator('.on-chain-loader')

test.describe('on-chain config', () => {
  test('a loaded config simulates exactly like the same config built in the tool', async ({
    page,
  }) => {
    await mockAccount(page, DBC_PROGRAM)
    await page.goto('/')
    await loader(page)
      .getByRole('textbox', { name: 'Config or pool address' })
      .fill(CONFIG_ADDRESS)
    await loader(page).getByRole('button', { name: 'Load' }).click()
    await expect(loader(page).getByRole('status')).toContainText('Loaded')

    const onChainRow = page.getByRole('row', {
      name: /On-chain: 4uQe…iofM \(devnet\)/,
    })
    const flatRow = page.getByRole('row', { name: /^Flat 1%/ })
    await expect(onChainRow).toContainText('not editable')
    const cells = async (row: typeof flatRow) =>
      (await row.getByRole('cell').allTextContents()).map((c) => c.trim())
    expect(await cells(onChainRow)).toEqual(await cells(flatRow))
  })

  test('refuses an account owned by another program', async ({ page }) => {
    await mockAccount(page, OTHER_PROGRAM)
    await page.goto('/')
    await loader(page)
      .getByRole('textbox', { name: 'Config or pool address' })
      .fill(CONFIG_ADDRESS)
    await loader(page).getByRole('button', { name: 'Load' }).click()
    await expect(loader(page).getByRole('status')).toContainText(
      'does not belong to Meteora’s DBC program',
    )
    await expect(page.locator('tbody tr')).toHaveCount(5)
  })

  test('refuses text that is not an address without reading the chain', async ({
    page,
  }) => {
    const counter = await mockAccount(page, DBC_PROGRAM)
    await page.goto('/')
    await loader(page)
      .getByRole('textbox', { name: 'Config or pool address' })
      .fill('not an address')
    await loader(page).getByRole('button', { name: 'Load' }).click()
    await expect(loader(page).getByRole('status')).toContainText(
      'not a Solana address',
    )
    expect(counter.reads).toBe(0)
  })

  test('says how real launches on a loaded config went — here, that there are none yet', async ({
    page,
  }) => {
    await mockDevnetRpc(page, {
      simulationError: null,
      accounts: {
        [CONFIG_ADDRESS]: { owner: DBC_PROGRAM, base64: flatPoolConfig.base64 },
      },
    })
    await page.goto('/')
    await loader(page).getByRole('textbox').fill(CONFIG_ADDRESS)
    await loader(page).getByRole('button', { name: 'Load' }).click()
    await expect(loader(page)).toContainText(
      'How real launches on this config went',
    )
    await expect(loader(page)).toContainText(
      'No pools have been launched with this config yet.',
    )
  })
})
