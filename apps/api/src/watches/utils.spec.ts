import { describe, expect, it } from 'vitest'
import { WatchEventType, WatchKind } from './constants'
import type { WatchEventRow, WatchRow } from './types'
import {
  configChanges,
  feeWalletChanges,
  isConfigState,
  isFeeWalletState,
  toWatchEventView,
  toWatchView,
  watchEventPayload,
} from './utils'

const config = (
  totalPools: number,
  graduated: number,
  risks: string[] = [],
) => ({
  totalPools,
  graduated,
  risks,
})

describe('config watch changes', () => {
  it('records nothing on the first look — it is only the baseline', () => {
    expect(configChanges(null, config(3, 1))).toEqual([])
  })

  it('records nothing when nothing changed, whatever the risk order', () => {
    expect(
      configChanges(config(3, 1, ['a', 'b']), config(3, 1, ['b', 'a'])),
    ).toEqual([])
  })

  it('records a new pool, a graduation and a change of risks, each once', () => {
    const types = configChanges(
      config(3, 1, ['a']),
      config(4, 2, ['a', 'b']),
    ).map((c) => c.type)
    expect(types).toEqual([
      WatchEventType.NewPool,
      WatchEventType.Graduation,
      WatchEventType.RisksChanged,
    ])
  })
})

describe('fee-wallet watch changes', () => {
  it('records the crossing above the threshold once, not while it stays above', () => {
    expect(
      feeWalletChanges({ unclaimedSol: 0.5 }, { unclaimedSol: 1.2 }, 1),
    ).toHaveLength(1)
    expect(
      feeWalletChanges({ unclaimedSol: 1.2 }, { unclaimedSol: 1.5 }, 1),
    ).toEqual([])
    expect(
      feeWalletChanges({ unclaimedSol: 0.5 }, { unclaimedSol: 0.9 }, 1),
    ).toEqual([])
  })

  it('reports a wallet already above the threshold on its first look', () => {
    expect(feeWalletChanges(null, { unclaimedSol: 2 }, 1)[0]?.type).toBe(
      WatchEventType.FeesAboveThreshold,
    )
  })
})

describe('stored watch state', () => {
  it('reads back a stored state only when it has the expected shape', () => {
    expect(isConfigState(config(1, 0))).toBe(true)
    expect(isConfigState({ unclaimedSol: 1 })).toBe(false)
    expect(isConfigState(null)).toBe(false)
    expect(isFeeWalletState({ unclaimedSol: 1 })).toBe(true)
    expect(isFeeWalletState(config(1, 0))).toBe(false)
    expect(isFeeWalletState('1')).toBe(false)
  })
})

describe('watch views and delivery payloads', () => {
  const createdAt = new Date('2026-10-05T10:00:00Z')
  const watch: WatchRow = {
    id: 'watch-1',
    accountId: 'account-1',
    kind: WatchKind.FeeWallet,
    target: 'wallet-1',
    network: 'devnet',
    thresholdSol: 1.5,
    paused: false,
    lastState: { unclaimedSol: 2 },
    lastCheckedAt: null,
    createdAt,
  }
  const event: WatchEventRow = {
    id: 'event-1',
    watchId: watch.id,
    accountId: watch.accountId,
    type: WatchEventType.FeesAboveThreshold,
    before: { unclaimedSol: 1 },
    after: { unclaimedSol: 2 },
    seenAt: createdAt,
  }

  it('shows a watch without its stored state', () => {
    expect(toWatchView(watch)).toEqual({
      id: 'watch-1',
      kind: WatchKind.FeeWallet,
      target: 'wallet-1',
      network: 'devnet',
      thresholdSol: 1.5,
      paused: false,
      lastCheckedAt: null,
      createdAt: '2026-10-05T10:00:00.000Z',
    })
    expect(toWatchView({ ...watch, kind: 'unknown' }).kind).toBe(
      WatchKind.Config,
    )
  })

  it('shows an event with its before and after', () => {
    expect(toWatchEventView(event)).toEqual({
      id: 'event-1',
      watchId: 'watch-1',
      type: WatchEventType.FeesAboveThreshold,
      before: { unclaimedSol: 1 },
      after: { unclaimedSol: 2 },
      seenAt: '2026-10-05T10:00:00.000Z',
    })
  })

  it('delivers an event with the watch it belongs to, never its account', () => {
    const payload = watchEventPayload(watch, event)
    expect(payload).toEqual({
      type: WatchEventType.FeesAboveThreshold,
      eventId: 'event-1',
      watch: {
        id: 'watch-1',
        kind: WatchKind.FeeWallet,
        target: 'wallet-1',
        network: 'devnet',
      },
      before: { unclaimedSol: 1 },
      after: { unclaimedSol: 2 },
      seenAt: '2026-10-05T10:00:00.000Z',
    })
    expect(JSON.stringify(payload)).not.toContain('account-1')
  })
})
