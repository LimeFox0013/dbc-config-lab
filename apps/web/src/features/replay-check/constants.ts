import type { ReplayedLaunch } from './types'

/** How a replayed launch's curve charged its fee — the part each one exercised. */
export enum FeeSetup {
  VolatilityFee = 'volatility-fee',
  FeesInToken = 'fees-in-token',
  FeesInSol = 'fees-in-sol',
}

/**
 * Results of `scripts/mainnet-replay-verify.ts` (latest runs 2026-10-02/03): every swap of
 * these mainnet launches, replayed from a fresh pool, matched the program's recorded fees,
 * output and price exactly, as did each migrated pool's opening liquidity and the
 * liquidity its creator later withdrew.
 */
export const REPLAYED_LAUNCHES: readonly ReplayedLaunch[] = [
  {
    curvePool: '8EeVgd9m2fvNRQ9DSqpKonfubzkkwFkPcAJQPWCvuR37',
    curveSwaps: 44,
    feeSetup: FeeSetup.VolatilityFee,
  },
  {
    curvePool: 'Z4EsKJjpBuxKqbRNzxeWbj7PsaNcp2vjZpAHWu86Wkn',
    curveSwaps: 277,
    feeSetup: FeeSetup.FeesInToken,
    migrated: {
      pool: 'Abi3ww223iVFgv7zfTBxPoAR1f7XxFWHLufQHNvGhUUC',
      swaps: 878,
    },
  },
  {
    curvePool: 'CsyNckGb13GMTvuSuBPA9wd6VgbBLESB5ZMnc3HV7TJU',
    curveSwaps: 1,
    feeSetup: FeeSetup.FeesInSol,
    migrated: {
      pool: 'BrL83GbzF6BdCkqNkarH2ghX2ZzhDAjWgFDm4jztWeEp',
      swaps: 11,
    },
  },
]

/** The command that reproduces a launch's check, pool addresses appended. */
export const REPLAY_COMMAND =
  'npx tsx apps/web/scripts/mainnet-replay-verify.ts'
