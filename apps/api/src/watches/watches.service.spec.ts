import { BadRequestException } from '@nestjs/common'
import { SolanaNetwork } from '@dbc-config-lab/core/core/shared'
import { describe, expect, it } from 'vitest'
import type { Account } from '../accounts'
import { mockDb } from '../testing/mock-db'
import { WATCH_TEXT, WatchKind } from './constants'
import { WatchesService } from './watches.service'

const account: Account = {
  id: 'account-1',
  walletAddress: 'wallet-1',
  paidPlan: null,
  planEndsAt: null,
  createdAt: new Date(),
}

describe('WatchesService.add (watches)', () => {
  it('refuses a fee-wallet watch without a threshold before storing anything', async () => {
    await expect(
      new WatchesService(mockDb()).add(account, {
        kind: WatchKind.FeeWallet,
        target: 'wallet-2',
        network: SolanaNetwork.Devnet,
      }),
    ).rejects.toThrow(new BadRequestException(WATCH_TEXT.thresholdRequired))
  })
})
