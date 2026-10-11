import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  initialAccountState,
  mockAccountApi,
  NEW_KEY,
  NEW_KEY_PREFIX,
  NEW_WEBHOOK_SECRET,
  NOW,
  sampleWatch,
  signInMessage,
  watchLimitText,
} from './fixtures/account-api'
import type { AccountApiState } from './fixtures/account-api'
import {
  FAKE_WALLET_ADDRESS,
  FAKE_WALLET_NAME,
  PAYMENT_RECIPIENT,
} from './fixtures/constants'
import { mockDevnetRpc } from './fixtures/devnet-rpc'
import { installFakeWallet } from './fixtures/fake-wallet'

const openAccount = async (
  page: Page,
  overrides: Partial<AccountApiState> = {},
): Promise<AccountApiState> => {
  const state = initialAccountState(overrides)
  await installFakeWallet(page)
  await mockAccountApi(page, state)
  await page.goto('/account')
  return state
}

const signedMessages = (page: Page): Promise<unknown> =>
  page.evaluate(() => Reflect.get(window, '__fakeWalletMessages'))

/**
 * The baselines are macOS renders; font rasterising differs elsewhere, so the
 * pixel comparison runs only there. Every behavioural assertion runs everywhere.
 */
const SNAPSHOT_PLATFORM = 'darwin'
const expectPageSnapshot = async (page: Page, name: string): Promise<void> => {
  if (process.platform !== SNAPSHOT_PLATFORM) return
  await expect(page).toHaveScreenshot(name, { fullPage: true })
}

test.describe('account page signed out', () => {
  test('offers only signing in with a wallet', async ({ page }) => {
    await openAccount(page)
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: `Connect ${FAKE_WALLET_NAME}` }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Plan and usage' }),
    ).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'API keys' })).toHaveCount(0)
    // Being signed out is the starting state, not a refusal to show.
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expectPageSnapshot(page, 'account-signed-out.png')
  })

  test('links back to the lab’s main page', async ({ page }) => {
    await openAccount(page)
    await page.getByRole('link', { name: 'Back to the lab' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(
      page.getByRole('heading', { name: 'DBC Config Lab', level: 1 }),
    ).toBeVisible()
  })

  test('is linked from the lab’s main page', async ({ page }) => {
    await mockAccountApi(page, initialAccountState())
    await page.goto('/')
    await page.getByRole('link', { name: 'Account' }).click()
    await expect(page).toHaveURL(/\/account$/)
    await expect(
      page.getByRole('heading', { name: 'Account', level: 1 }),
    ).toBeVisible()
  })

  test('signs in by signing the service’s challenge with the wallet', async ({
    page,
  }) => {
    const state = await openAccount(page)
    await page
      .getByRole('button', { name: `Connect ${FAKE_WALLET_NAME}` })
      .click()
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(
      page.getByText(`Signed in as ${FAKE_WALLET_ADDRESS}`),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Plan and usage' }),
    ).toBeVisible()
    expect(await signedMessages(page)).toEqual([
      signInMessage(FAKE_WALLET_ADDRESS),
    ])
    const session = state.requests.find((r) => r.path === '/auth/session')
    expect(session?.body).toEqual({
      message: signInMessage(FAKE_WALLET_ADDRESS),
      signature: expect.stringMatching(/^[1-9A-HJ-NP-Za-km-z]{80,90}$/),
    })
  })
})

test.describe('account page signed in', () => {
  test('shows the plan and today’s calls against the plan’s limit', async ({
    page,
  }) => {
    await openAccount(page, { signedIn: true, watches: [sampleWatch('w1')] })
    const plan = page.locator('.account-plan')
    await expect(plan).toContainText('Free')
    await expect(plan).toContainText('12 of 200')
    await expect(plan).not.toContainText('Paid until')
    await expectPageSnapshot(page, 'account-signed-in.png')
  })

  test('signs out', async ({ page }) => {
    await openAccount(page, { signedIn: true })
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('shows a new API key once; after a reload only its prefix', async ({
    page,
  }) => {
    await openAccount(page, { signedIn: true })
    const keys = page.locator('.account-keys')
    await keys.getByRole('textbox', { name: 'Label' }).fill('ci-agent')
    await keys.getByRole('button', { name: 'Create key' }).click()

    await expect(keys.getByText(NEW_KEY)).toBeVisible()
    await expect(keys.getByRole('button', { name: 'Copy' })).toBeVisible()
    await expect(keys.locator('.account-keys__row')).toContainText('ci-agent')

    await page.reload()
    await expect(keys.locator('.account-keys__row')).toContainText(
      `${NEW_KEY_PREFIX}…`,
    )
    await expect(page.getByText(NEW_KEY)).toHaveCount(0)
  })

  test('dismissing a new key removes it from the page', async ({ page }) => {
    await openAccount(page, { signedIn: true })
    const keys = page.locator('.account-keys')
    await keys.getByRole('textbox', { name: 'Label' }).fill('ci-agent')
    await keys.getByRole('button', { name: 'Create key' }).click()
    await keys.getByRole('button', { name: 'I have saved it' }).click()
    await expect(page.getByText(NEW_KEY)).toHaveCount(0)
  })

  test('revoking a key removes it from the list', async ({ page }) => {
    const state = await openAccount(page, {
      signedIn: true,
      keys: [
        {
          id: 'key-1',
          label: 'ci-agent',
          prefix: NEW_KEY_PREFIX,
          createdAt: NOW,
          lastUsedAt: null,
        },
      ],
    })
    const keys = page.locator('.account-keys')
    await expect(keys.locator('.account-keys__row')).toContainText('ci-agent')
    await keys.getByRole('button', { name: 'Revoke' }).click()
    await expect(keys.locator('.account-keys__row')).toHaveCount(0)
    await expect(keys.getByText('No keys yet.')).toBeVisible()
    expect(state.requests).toContainEqual(
      expect.objectContaining({
        method: 'DELETE',
        path: '/account/keys/key-1',
      }),
    )
  })

  test('pauses, resumes and deletes a watch, keeping the plan’s count current', async ({
    page,
  }) => {
    await openAccount(page, { signedIn: true, watches: [sampleWatch('w1')] })
    const watches = page.locator('.account-watches')
    const row = watches.locator('.account-watches__row')
    const watchCount = page.locator('.account-plan dt:has-text("Watches") + dd')
    await expect(watchCount).toHaveText('1')

    await row.getByRole('button', { name: 'Pause' }).click()
    await expect(row).toContainText('paused')
    await row.getByRole('button', { name: 'Resume' }).click()
    await expect(row).toContainText('active')

    await row.getByRole('button', { name: 'Delete' }).click()
    await expect(row).toHaveCount(0)
    await expect(watches.getByText('No watches yet.')).toBeVisible()
    await expect(watchCount).toHaveText('0')
  })

  test('adding a watch past the plan’s limit shows the service’s refusal', async ({
    page,
  }) => {
    await openAccount(page, {
      signedIn: true,
      watches: [sampleWatch('w1'), sampleWatch('w2'), sampleWatch('w3')],
    })
    const watches = page.locator('.account-watches')
    await watches
      .getByRole('textbox', { name: 'Address' })
      .fill(PAYMENT_RECIPIENT)
    await watches.getByRole('button', { name: 'Add watch' }).click()
    await expect(watches.getByRole('alert')).toHaveText(watchLimitText(3))
    await expect(watches.locator('.account-watches__row')).toHaveCount(3)
  })

  test('a webhook’s secret is shown once, and a test delivery appears in the log', async ({
    page,
  }) => {
    await openAccount(page, { signedIn: true })
    const hooks = page.locator('.account-webhooks')
    await hooks
      .getByRole('textbox', { name: 'https URL' })
      .fill('https://hooks.example.com/lab')
    await hooks.getByRole('button', { name: 'Add address' }).click()
    await expect(hooks.getByText(NEW_WEBHOOK_SECRET)).toBeVisible()
    await hooks.getByRole('button', { name: 'I have saved it' }).click()
    await expect(page.getByText(NEW_WEBHOOK_SECRET)).toHaveCount(0)

    await hooks.getByRole('button', { name: 'Send test' }).click()
    const row = hooks.locator('.account-webhooks__delivery')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('test')
    await expect(row).toContainText('https://hooks.example.com/lab')
    await expect(row).toContainText('delivered')
    await expect(row).toContainText('200')
  })

  test('deletes a webhook address', async ({ page }) => {
    await openAccount(page, {
      signedIn: true,
      webhooks: [
        { id: 'hook-1', url: 'https://hooks.example.com/lab', createdAt: NOW },
      ],
    })
    const hooks = page.locator('.account-webhooks')
    await expect(hooks.locator('.account-webhooks__row')).toContainText(
      'https://hooks.example.com/lab',
    )
    await hooks.getByRole('button', { name: 'Delete' }).click()
    await expect(hooks.locator('.account-webhooks__row')).toHaveCount(0)
    await expect(hooks.getByText('No webhook addresses yet.')).toBeVisible()
  })

  test('pays for Pro from the wallet and shows it paid only once the service credits it', async ({
    page,
  }) => {
    const methods = await mockDevnetRpc(page, { simulationError: null })
    const state = await openAccount(page, {
      signedIn: true,
      checksBeforeCredit: 1,
    })
    const plan = page.locator('.account-plan')
    await plan.getByRole('button', { name: 'Pay for Pro with USDC' }).click()
    await expect(plan).toContainText('49 USDC')
    await expect(plan).toContainText(PAYMENT_RECIPIENT)

    await plan
      .getByRole('button', { name: `Connect ${FAKE_WALLET_NAME}` })
      .click()
    await plan.getByRole('button', { name: 'Prepare payment' }).click()
    await plan.getByRole('button', { name: 'Sign and send in wallet' }).click()

    await expect(plan.getByRole('status')).toContainText(
      'Waiting for the service to confirm',
    )
    await expect(plan.locator('.account-plan__plan')).toHaveText('Free')
    await expect(plan.getByRole('status')).toContainText(
      'Payment credited. Pro is active until 2026-11-04 09:30 UTC.',
      { timeout: 15_000 },
    )
    await expect(plan.locator('.account-plan__plan')).toHaveText('Pro')
    await expect(plan).toContainText('12 of 20,000')
    expect(state.paymentChecks).toBe(2)
    expect(methods).toContain('simulateTransaction')
  })
})
