import { expect, test } from '@playwright/test'

test.describe('replay check', () => {
  test('states the real-launch check and links each launch on the explorer', async ({
    page,
  }) => {
    await page.goto('/')
    const check = page.locator('.replay-check')
    await expect(check.locator('summary')).toContainText(
      '5 mainnet launches, 335 bonding-curve swaps, 4 graduations and 919 swaps after graduation',
    )
    await check.locator('summary').click()
    const links = check.getByRole('link')
    await expect(links).toHaveCount(9)
    await expect(check).toContainText('1 curve swap ·')
    await expect(links.first()).toHaveAttribute(
      'href',
      'https://explorer.solana.com/address/8EeVgd9m2fvNRQ9DSqpKonfubzkkwFkPcAJQPWCvuR37',
    )
    await expect(check.locator('code').nth(1)).toHaveText(
      'npx tsx apps/web/scripts/mainnet-replay-verify.ts Z4EsKJjpBuxKqbRNzxeWbj7PsaNcp2vjZpAHWu86Wkn Abi3ww223iVFgv7zfTBxPoAR1f7XxFWHLufQHNvGhUUC',
    )
  })
})
