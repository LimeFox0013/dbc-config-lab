import BN from 'bn.js'
import { describe, expect, it } from 'vitest'
import {
  CollectFeeMode,
  DEAD_LIQUIDITY,
  decodePodAlignedFeeTimeScheduler,
  getDynamicFeeParams,
  getPriceFromSqrtPrice,
} from '@meteora-ag/cp-amm-sdk'
import {
  createDbcProgram,
  DammV2BaseFeeMode,
  DammV2DynamicFeeMode,
  MigratedCollectFeeMode,
  MigrationFeeOption,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectionFor } from '../config-deploy'
import { fromPoolConfig } from '../onchain-config'
import { compileLaunchConfig, DEFAULT_LAUNCH_CONFIG } from '../launch-config'
import type { LaunchConfig } from '../launch-config'
import {
  afterMigratedSwap,
  lockedLiquidity,
  migratedFeeBps,
  migratedFeeSchedule,
  migratedUnsupportedReason,
  pullableLiquidityPercent,
  quoteMigratedSwap,
  toMigratedPool,
  withUnlockedLiquidityPulled,
} from '.'
import type { MigratedPool, MigratedSwap } from '.'
import { SolanaNetwork } from '../shared'
import { toPoolConfig } from '../launch-simulator'

const compile = (config: LaunchConfig) => {
  const compiled = compileLaunchConfig(config)
  if (!compiled.ok) throw new Error(compiled.reason)
  return compiled.parameters
}

/** Graduation time, in unix seconds; swaps in these tests run then. */
const OPENED_AT = new BN(1_767_225_600)
const parameters = compile(DEFAULT_LAUNCH_CONFIG)
const pool = toMigratedPool(parameters, toPoolConfig(parameters), OPENED_AT)
const BASE_DECIMALS = DEFAULT_LAUNCH_CONFIG.token.tokenBaseDecimal

const compoundingConfig: LaunchConfig = {
  ...DEFAULT_LAUNCH_CONFIG,
  migration: {
    ...DEFAULT_LAUNCH_CONFIG.migration,
    migrationFeeOption: MigrationFeeOption.Customizable,
    migratedPoolFee: {
      collectFeeMode: MigratedCollectFeeMode.Compounding,
      dynamicFee: DammV2DynamicFeeMode.Disabled,
      poolFeeBps: 100,
      compoundingFeeBps: 5000,
    },
  },
}
const compoundingParameters = compile(compoundingConfig)

const customMigration = (
  migratedPoolFee: NonNullable<LaunchConfig['migration']['migratedPoolFee']>,
): LaunchConfig => ({
  ...DEFAULT_LAUNCH_CONFIG,
  migration: {
    ...DEFAULT_LAUNCH_CONFIG.migration,
    migrationFeeOption: MigrationFeeOption.Customizable,
    migratedPoolFee,
  },
})
const dynamicParameters = compile(
  customMigration({
    collectFeeMode: MigratedCollectFeeMode.QuoteToken,
    dynamicFee: DammV2DynamicFeeMode.Enabled,
    poolFeeBps: 100,
  }),
)
const FALLING_SCHEDULE = {
  endingBaseFeeBps: 25,
  numberOfPeriod: 10,
  priceMultiple: 10,
  schedulerExpirationDuration: 86_400,
}
const fallingParameters = compile(
  customMigration({
    collectFeeMode: MigratedCollectFeeMode.QuoteToken,
    dynamicFee: DammV2DynamicFeeMode.Disabled,
    poolFeeBps: 100,
    baseFeeMode: DammV2BaseFeeMode.FeeMarketCapSchedulerLinear,
    marketCapFeeSchedulerParams: FALLING_SCHEDULE,
  }),
)
/** The fee a swap paid, as a share of its input in bps. */
const feeBpsOf = (swap: MigratedSwap): number =>
  swap.quote.claimingFee
    .add(swap.quote.protocolFee)
    .add(swap.quote.referralFee)
    .muln(10_000)
    .div(swap.quote.includedFeeInputAmount)
    .toNumber()

interface MigrationFixture {
  configBase64: string
  opening: {
    liquidity: string
    sqrtPrice: string
    reserveA: string
    reserveB: string
  }
}
const readFixture = (name: string): MigrationFixture =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8'))
const compoundingFixture = readFixture('compounding-migration.json')
const feeScheduledFixture = readFixture('fee-scheduled-migration.json')

/** A real migration's config, and the pool the simulator opens for it. */
const openedFor = (fixture: MigrationFixture) => {
  const parameters = fromPoolConfig(
    createDbcProgram(
      connectionFor(SolanaNetwork.Mainnet),
    ).program.coder.accounts.decode(
      'poolConfig',
      Buffer.from(fixture.configBase64, 'base64'),
    ),
  )
  return {
    parameters,
    opened: toMigratedPool(parameters, toPoolConfig(parameters), OPENED_AT),
  }
}
const openingOf = (pool: MigratedPool) => ({
  liquidity: pool.liquidity.toString(),
  sqrtPrice: pool.sqrtPrice.toString(),
  reserveA: pool.tokenAAmount.toString(),
  reserveB: pool.tokenBAmount.toString(),
})

describe('toMigratedPool', () => {
  it('stores the flat fee in a record the SDK decodes back', () => {
    const decoded = decodePodAlignedFeeTimeScheduler(
      Buffer.from(pool.poolFees.baseFee.baseFeeInfo.data),
    )
    expect(decoded.cliffFeeNumerator.toString()).toBe('10000000') // 1% of 1e9
    expect(decoded.numberOfPeriod).toBe(0)
  })

  it('opens at the migration price with the migrated SOL less the program’s 0.2% share', () => {
    expect(pool.sqrtPrice.eq(toPoolConfig(parameters).migrationSqrtPrice)).toBe(
      true,
    )
    // 85 SOL threshold, no config migration fee; the program keeps 20 bps of it.
    expect(pool.tokenBAmount.toString()).toBe('84830000000')
  })

  it('reads the fixed fee rate from the migration fee option', () => {
    expect(migratedFeeBps(parameters)).toBe(100)
  })
})

describe('quoteMigratedSwap', () => {
  it('sells a small amount at spot price minus the 1% fee (price impact negligible)', () => {
    const tokenCount = 10_000
    const tokens = new BN(tokenCount).mul(new BN(10 ** BASE_DECIMALS))
    const { quote } = quoteMigratedSwap(pool, true, tokens, OPENED_AT)
    const price = getPriceFromSqrtPrice(
      pool.sqrtPrice,
      BASE_DECIMALS,
      9,
    ).toNumber()
    const expectedSol = tokenCount * price * 0.99
    const receivedSol = Number(quote.outputAmount.toString()) / 1e9
    expect(Math.abs(receivedSol - expectedSol) / expectedSol).toBeLessThan(1e-4)
  })

  it('moves the price down on a sell and up on a buy', () => {
    const sell = quoteMigratedSwap(
      pool,
      true,
      new BN(10).pow(new BN(13)),
      OPENED_AT,
    )
    const buy = quoteMigratedSwap(pool, false, new BN(1_000_000_000), OPENED_AT)
    expect(sell.quote.nextSqrtPrice.lt(pool.sqrtPrice)).toBe(true)
    expect(buy.quote.nextSqrtPrice.gt(pool.sqrtPrice)).toBe(true)
  })
})

describe('migratedUnsupportedReason', () => {
  it('accepts the default fixed-fee migration', () => {
    expect(migratedUnsupportedReason(parameters)).toBeNull()
  })

  it('accepts the dynamic fee and a falling fee on the graduated pool', () => {
    expect(migratedUnsupportedReason(dynamicParameters)).toBeNull()
    expect(migratedUnsupportedReason(fallingParameters)).toBeNull()
  })

  it('accepts a compounding graduation pool', () => {
    expect(migratedUnsupportedReason(compoundingParameters)).toBeNull()
  })
})

describe('the graduated pool dynamic fee', () => {
  const opened = toMigratedPool(
    dynamicParameters,
    toPoolConfig(dynamicParameters),
    OPENED_AT,
  )
  const BUY = new BN(10).pow(new BN(11))

  it('takes the settings the program derives from the pool fee', () => {
    const expected = getDynamicFeeParams(100)
    expect(opened.poolFees.dynamicFee.initialized).toBe(1)
    expect(opened.poolFees.dynamicFee.variableFeeControl).toBe(
      expected.variableFeeControl,
    )
    expect(opened.poolFees.dynamicFee.maxVolatilityAccumulator).toBe(
      expected.maxVolatilityAccumulator,
    )
  })

  it('charges more after a sharp move, up to a fifth of the pool fee, until a pause resets it', () => {
    const first = quoteMigratedSwap(opened, false, BUY, OPENED_AT)
    expect(feeBpsOf(first)).toBe(100)
    const moved = afterMigratedSwap(first)
    expect(moved.poolFees.dynamicFee.volatilityAccumulator.gtn(0)).toBe(true)
    // The fee comes from the volatility the previous swap left; a pause only decays what
    // the next swap accumulates from.
    const next = quoteMigratedSwap(moved, false, BUY, OPENED_AT.addn(1))
    expect(feeBpsOf(next)).toBeGreaterThan(100)
    expect(feeBpsOf(next)).toBeLessThanOrEqual(120)
    const afterPause = afterMigratedSwap(
      quoteMigratedSwap(moved, false, new BN(1000), OPENED_AT.addn(3600)),
    )
    expect(
      feeBpsOf(quoteMigratedSwap(afterPause, false, BUY, OPENED_AT.addn(3601))),
    ).toBe(100)
  })
})

describe('the graduated pool falling fee', () => {
  const opened = toMigratedPool(
    fallingParameters,
    toPoolConfig(fallingParameters),
    OPENED_AT,
  )

  it('describes the schedule the config stores', () => {
    const schedule = migratedFeeSchedule(fallingParameters)
    expect(schedule).toMatchObject({
      exponential: false,
      endingFeeBps: FALLING_SCHEDULE.endingBaseFeeBps,
      steps: FALLING_SCHEDULE.numberOfPeriod,
      durationSeconds: FALLING_SCHEDULE.schedulerExpirationDuration,
    })
    expect(schedule?.priceMultiple).toBeCloseTo(
      FALLING_SCHEDULE.priceMultiple,
      0,
    )
    expect(migratedFeeSchedule(parameters)).toBeNull()
  })

  it('charges the pool fee at graduation, less as the price rises, and the ending fee once it expires', () => {
    const small = new BN(1_000_000_000)
    const atOpening = quoteMigratedSwap(opened, false, small, OPENED_AT)
    expect(feeBpsOf(atOpening)).toBe(100)
    const risen = afterMigratedSwap(
      quoteMigratedSwap(opened, false, new BN(10).pow(new BN(12)), OPENED_AT),
    )
    expect(risen.sqrtPrice.gt(opened.sqrtPrice)).toBe(true)
    expect(
      feeBpsOf(quoteMigratedSwap(risen, false, small, OPENED_AT)),
    ).toBeLessThan(100)
    const expired = OPENED_AT.addn(
      FALLING_SCHEDULE.schedulerExpirationDuration + 1,
    )
    expect(feeBpsOf(quoteMigratedSwap(opened, false, small, expired))).toBe(
      FALLING_SCHEDULE.endingBaseFeeBps,
    )
  })
})

describe('lockedLiquidity', () => {
  it('keeps exactly what a real pool kept after its creator withdrew', () => {
    // Pool Abi3ww…UhUUC opened with this liquidity; the creator vested 11% and withdrew
    // the unlocked 89%, leaving the vested share rounded down as the program splits it.
    const opened = new BN('7845ca5bb2b539280647b6b46f', 16)
    const split = {
      ...parameters,
      partnerPermanentLockedLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 0,
      creatorLiquidityPercentage: 89,
      creatorLiquidityVestingInfo: {
        ...parameters.creatorLiquidityVestingInfo,
        vestingPercentage: 11,
      },
    }
    expect(lockedLiquidity(split, opened).toString(16)).toBe(
      'd3ae07fd8c722727b9220e5c4',
    )
  })

  it('keeps everything when all liquidity is permanently locked', () => {
    expect(lockedLiquidity(parameters, pool.liquidity).eq(pool.liquidity)).toBe(
      true,
    )
  })
})

describe('withUnlockedLiquidityPulled', () => {
  it('returns the unlocked share of the pool and leaves the rest', () => {
    const split = {
      ...parameters,
      partnerPermanentLockedLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 10,
      creatorLiquidityPercentage: 90,
    }
    const { pool: left, pulled } = withUnlockedLiquidityPulled(split, pool)
    const unlockedQuote = pool.tokenBAmount.muln(9).divn(10)

    expect(left.liquidity.eq(lockedLiquidity(split, pool.liquidity))).toBe(true)
    // Rounded down, so at most a few lamports under 90% of the deposited SOL.
    expect(pulled.quote.lte(unlockedQuote)).toBe(true)
    expect(unlockedQuote.sub(pulled.quote).ltn(10)).toBe(true)
    // The tokens returned are worth something at the pool's price too.
    expect(pulled.value.gt(pulled.quote)).toBe(true)
  })
})

describe('pullableLiquidityPercent', () => {
  it('is zero when everything is locked, and the unlocked shares otherwise', () => {
    expect(pullableLiquidityPercent(parameters)).toBe(0)
    expect(
      pullableLiquidityPercent({
        ...parameters,
        partnerLiquidityPercentage: 15,
        partnerPermanentLockedLiquidityPercentage: 35,
        creatorLiquidityPercentage: 40,
        creatorPermanentLockedLiquidityPercentage: 10,
      }),
    ).toBe(55)
  })
})

describe('compounding graduation pool', () => {
  it('opens exactly as a real compounding migration did', () => {
    const { opened } = openedFor(compoundingFixture)
    expect(opened.collectFeeMode).toBe(CollectFeeMode.Compounding)
    expect(opened.poolFees.compoundingFeeBps).toBe(1000)
    expect(compoundingFixture.opening).toMatchObject(openingOf(opened))
  })

  it('opens exactly as a real migration with a migration fee and a falling fee did', () => {
    // A 6% migration fee leaves a quote amount the program rounds up.
    const { parameters, opened } = openedFor(feeScheduledFixture)
    expect(parameters.migrationFee.feePercentage).toBe(6)
    expect(opened.poolFees.dynamicFee.initialized).toBe(1)
    expect(migratedFeeSchedule(parameters)?.exponential).toBe(true)
    expect(feeScheduledFixture.opening).toMatchObject(openingOf(opened))
  })

  const opened = toMigratedPool(
    compoundingParameters,
    toPoolConfig(compoundingParameters),
    OPENED_AT,
  )

  it('keeps the compounding share of a buy in its quote reserve', () => {
    const swap = quoteMigratedSwap(
      opened,
      false,
      new BN(1_000_000_000),
      OPENED_AT,
    )
    const after = afterMigratedSwap(swap)
    expect(swap.quote.compoundingFee.gtn(0)).toBe(true)
    expect(after.tokenBAmount.toString()).toBe(
      opened.tokenBAmount
        .add(swap.quote.excludedFeeInputAmount)
        .add(swap.quote.compoundingFee)
        .toString(),
    )
    expect(after.tokenAAmount.toString()).toBe(
      opened.tokenAAmount.sub(swap.quote.outputAmount).toString(),
    )
    expect(after.sqrtPrice.gt(opened.sqrtPrice)).toBe(true)
  })

  it('pays a liquidity pull out of its reserves pro rata, keeping the dead liquidity', () => {
    const unlocked = compile({
      ...compoundingConfig,
      liquidityDistribution: {
        partnerLiquidityPercentage: 0,
        partnerPermanentLockedLiquidityPercentage: 10,
        creatorLiquidityPercentage: 90,
        creatorPermanentLockedLiquidityPercentage: 0,
      },
    })
    const pool = toMigratedPool(unlocked, toPoolConfig(unlocked), OPENED_AT)
    const { pool: left, pulled } = withUnlockedLiquidityPulled(unlocked, pool)
    expect(left.liquidity.gt(DEAD_LIQUIDITY)).toBe(true)
    expect(left.tokenBAmount.add(pulled.quote).toString()).toBe(
      pool.tokenBAmount.toString(),
    )
    // Roughly 90% of what LPs can own leaves; the dead liquidity never can.
    const share = pulled.quote.muln(1000).div(pool.tokenBAmount).toNumber()
    expect(share).toBeGreaterThan(890)
    expect(share).toBeLessThan(900)
  })
})
