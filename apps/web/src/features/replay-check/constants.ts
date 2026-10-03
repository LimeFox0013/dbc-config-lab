import type { ReplayedLaunch } from './types'

/** How a replayed launch's curve charged its fee — the part each one exercised. */
export enum FeeSetup {
  VolatilityFee = 'volatility-fee',
  FeesInToken = 'fees-in-token',
  FeesInSol = 'fees-in-sol',
}

/** What a replayed graduated pool charged or kept beyond a flat fee. */
export enum GraduatedFeature {
  Compounding = 'compounding',
  VolatilityFee = 'volatility-fee',
  FallingFee = 'falling-fee',
}

/**
 * Results of `scripts/mainnet-replay-verify.ts` (latest runs 2026-10-02/03): every swap of
 * these mainnet launches, replayed from a fresh pool, matched the program's recorded fees,
 * output and price exactly, as did each migrated pool's opening liquidity (and, for
 * compounding pools, its reserves before and after every swap — including pools charging a
 * volatility fee or a fee falling as the price rises) and the liquidity its
 * creator later withdrew.
 */
export const REPLAYED_LAUNCHES: readonly ReplayedLaunch[] = [
  {
    curvePool: '8EeVgd9m2fvNRQ9DSqpKonfubzkkwFkPcAJQPWCvuR37',
    curveSwaps: 45,
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
  {
    curvePool: 'mLGAioB6nGn832SCdMn1aVTkKCPkxP3k3ZN6xJcDrvs',
    curveSwaps: 10,
    feeSetup: FeeSetup.VolatilityFee,
    migrated: {
      pool: 'F8Zd3TEBZtDHL7YoQAznWL3AyAbuhNaEybZELh1fuVZj',
      swaps: 26,
      features: [GraduatedFeature.Compounding],
    },
  },
  {
    curvePool: '2Sko3PeDw6WM2cg9zugRpbjrEBGdEYdpz1Mp7XgzgWhr',
    curveSwaps: 2,
    feeSetup: FeeSetup.FeesInSol,
    migrated: {
      pool: 'Esab82WjLvX58JrtEwASdppVcfB3fWF9rN3J6D2kmUxm',
      swaps: 4,
      features: [GraduatedFeature.Compounding],
    },
  },
  {
    curvePool: 'F7jZU2RSk4Ua2KJZEUPFVvdg5pPQAxJEVE3oJy15Ech',
    curveSwaps: 17,
    feeSetup: FeeSetup.VolatilityFee,
    migrated: {
      pool: '4tar3zNMmnBFwzQzM5JYr6LEXnB3qNbQ9PekGQ112H5m',
      swaps: 23,
      features: [GraduatedFeature.VolatilityFee, GraduatedFeature.Compounding],
    },
  },
  {
    curvePool: '8jDa3RDs1P7ec4N5Gb3fKAAL5pVECnUPsoVB5tzGrmf2',
    curveSwaps: 1,
    feeSetup: FeeSetup.VolatilityFee,
    migrated: {
      pool: 'FQuBxW2C9Tp5m9ETaihMbL7sCU3nE5BPD212fyJ7Mo4q',
      swaps: 25,
      features: [GraduatedFeature.VolatilityFee, GraduatedFeature.FallingFee],
    },
  },
  {
    curvePool: '895pYRYhfS4mcS7z2r1Mm4PkFqbVZJDCPh5PwuZqdzun',
    curveSwaps: 33,
    feeSetup: FeeSetup.VolatilityFee,
    migrated: {
      pool: 'HJbDALFNfK46YHsQh6YhxjTsmbqr9c1o6zD5VNMGU9TF',
      swaps: 3,
      features: [
        GraduatedFeature.VolatilityFee,
        GraduatedFeature.FallingFee,
        GraduatedFeature.Compounding,
      ],
    },
  },
]

/** The command that reproduces a launch's check, pool addresses appended. */
export const REPLAY_COMMAND =
  'npx tsx apps/web/scripts/mainnet-replay-verify.ts'
