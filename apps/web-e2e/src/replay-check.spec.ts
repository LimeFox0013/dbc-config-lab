import { expect, test } from '@playwright/test'

test.describe('replay check', () => {
  test('states the real-launch check and links each launch on the explorer', async ({
    page,
  }) => {
    await page.goto('/')
    const check = page.locator('.replay-check')
    await expect(check.locator('summary')).toContainText(
      '8 mainnet launches, 386 bonding-curve swaps, 7 graduations and 970 swaps after graduation',
    )
    await check.locator('summary').click()
    const links = check.getByRole('link')
    await expect(links).toHaveCount(15)
    await expect(check).toContainText('1 curve swap ·')
    await expect(check).toContainText(
      '(volatility fee, fee falling as the price rises, compounding pool)',
    )
    await expect(links.first()).toHaveAttribute(
      'href',
      'https://explorer.solana.com/address/8EeVgd9m2fvNRQ9DSqpKonfubzkkwFkPcAJQPWCvuR37',
    )
    await expect(check.locator('code').nth(1)).toHaveText(
      'npx tsx apps/web/scripts/mainnet-replay-verify.ts Z4EsKJjpBuxKqbRNzxeWbj7PsaNcp2vjZpAHWu86Wkn Abi3ww223iVFgv7zfTBxPoAR1f7XxFWHLufQHNvGhUUC',
    )
  })
})
