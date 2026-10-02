import type { Page } from '@playwright/test'
import { FAKE_WALLET_ADDRESS, FAKE_WALLET_NAME } from './constants'

/**
 * Registers a Wallet Standard wallet in the page before the app loads, using the
 * standard's own handshake events, so the app discovers it exactly like a real
 * extension. It connects with one fake devnet/mainnet account and records any
 * sign-and-send request instead of signing.
 */
export const installFakeWallet = async (page: Page): Promise<void> => {
  await page.addInitScript(
    ({ address, name }) => {
      const publicKey = new Uint8Array(32)
      publicKey[31] = 1
      const chains = ['solana:devnet', 'solana:mainnet'] as const
      const account = {
        address,
        publicKey,
        chains,
        features: ['solana:signAndSendTransaction'],
      }
      const requests: unknown[] = []
      Object.defineProperty(window, '__fakeWalletRequests', { value: requests })

      const wallet = {
        version: '1.0.0',
        name,
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=',
        chains,
        accounts: [],
        features: {
          'standard:connect': {
            version: '1.0.0',
            connect: async () => ({ accounts: [account] }),
          },
          'standard:events': { version: '1.0.0', on: () => () => undefined },
          'solana:signAndSendTransaction': {
            version: '1.0.0',
            supportedTransactionVersions: ['legacy', 0],
            signAndSendTransaction: async (...inputs: unknown[]) => {
              requests.push(...inputs)
              return [{ signature: new Uint8Array(64).fill(7) }]
            },
          },
        },
      }

      interface RegisterApi {
        register: (w: typeof wallet) => void
      }
      const isRegisterApi = (value: unknown): value is RegisterApi =>
        typeof value === 'object' &&
        value !== null &&
        'register' in value &&
        typeof value.register === 'function'
      const register = (api: RegisterApi) => api.register(wallet)

      // The standard's app-ready event is its own Event subclass carrying `detail`,
      // not a CustomEvent.
      window.addEventListener('wallet-standard:app-ready', (event) => {
        const detail: unknown = 'detail' in event ? event.detail : undefined
        if (isRegisterApi(detail)) register(detail)
      })
      window.dispatchEvent(
        new CustomEvent('wallet-standard:register-wallet', {
          detail: register,
        }),
      )
    },
    { address: FAKE_WALLET_ADDRESS, name: FAKE_WALLET_NAME },
  )
}
