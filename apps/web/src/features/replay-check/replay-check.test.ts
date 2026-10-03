import { describe, expect, it } from 'vitest'
import {
  REPLAY_COMMAND,
  REPLAYED_LAUNCHES,
  replayCommand,
  replayTotals,
} from '.'

describe('replayTotals', () => {
  it('adds up the recorded replays', () => {
    expect(replayTotals(REPLAYED_LAUNCHES)).toEqual({
      launches: 3,
      curveSwaps: 322,
      migrations: 2,
      migratedSwaps: 883,
    })
  })
})

describe('replayCommand', () => {
  it('appends the migrated pool only when the launch graduated', () => {
    const [notGraduated, graduated] = REPLAYED_LAUNCHES
    if (!notGraduated || !graduated?.migrated)
      throw new Error('fixtures changed')
    expect(replayCommand(REPLAY_COMMAND, notGraduated)).toBe(
      `${REPLAY_COMMAND} ${notGraduated.curvePool}`,
    )
    expect(replayCommand(REPLAY_COMMAND, graduated)).toBe(
      `${REPLAY_COMMAND} ${graduated.curvePool} ${graduated.migrated.pool}`,
    )
  })
})
