import BN from 'bn.js'
import { describe, expect, it } from 'vitest'
import {
  CollectFeeMode,
  DEAD_LIQUIDITY,
  decodePodAlignedFeeTimeScheduler,
  getPriceFromSqrtPrice,
} from '@meteora-ag/cp-amm-sdk'
import {
  createDbcProgram,
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
  migratedUnsupportedReason,
  pullableLiquidityPercent,
  quoteMigratedSwap,
  toMigratedPool,
  withUnlockedLiquidityPulled,
} from '.'
import { SolanaNetwork } from '../shared'
import { toPoolConfig } from '../launch-simulator'

const compile = (config: LaunchConfig) => {
  const compiled = compileLaunchConfig(config)
  if (!compiled.ok) throw new Error(compiled.reason)
  return compiled.parameters
}

const parameters = compile(DEFAULT_LAUNCH_CONFIG)
const pool = toMigratedPool(parameters, toPoolConfig(parameters))
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

const compoundingFixture: {
  configBase64: string
  opening: {
    liquidity: string
    sqrtPrice: string
    reserveA: string
    reserveB: string
  }
} = JSON.parse(
  readFileSync(
    join(__dirname, 'fixtures', 'compounding-migration.json'),
    'utf8',
  ),
)

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
    const { quote } = quoteMigratedSwap(pool, true, tokens, 0)
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
    const sell = quoteMigratedSwap(pool, true, new BN(10).pow(new BN(13)), 0)
    const buy = quoteMigratedSwap(pool, false, new BN(1_000_000_000), 0)
    expect(sell.quote.nextSqrtPrice.lt(pool.sqrtPrice)).toBe(true)
    expect(buy.quote.nextSqrtPrice.gt(pool.sqrtPrice)).toBe(true)
  })
})

describe('migratedUnsupportedReason', () => {
  it('accepts the default fixed-fee migration', () => {
    expect(migratedUnsupportedReason(parameters)).toBeNull()
  })

  it('refuses the dynamic fee on the migrated pool', () => {
    const customizable = {
      ...DEFAULT_LAUNCH_CONFIG,
      migration: {
        ...DEFAULT_LAUNCH_CONFIG.migration,
        migrationFeeOption: MigrationFeeOption.Customizable,
      },
    }
    expect(
      migratedUnsupportedReason({
        ...compile(customizable),
        migratedPoolFee: {
          collectFeeMode: 0,
          dynamicFee: DammV2DynamicFeeMode.Enabled,
          poolFeeBps: 100,
        },
      }),
    ).not.toBeNull()
  })

  it('accepts a compounding graduation pool', () => {
    expect(migratedUnsupportedReason(compoundingParameters)).toBeNull()
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
    const chain = compoundingFixture.opening
    const parameters = fromPoolConfig(
      createDbcProgram(
        connectionFor(SolanaNetwork.Mainnet),
      ).program.coder.accounts.decode(
        'poolConfig',
        Buffer.from(compoundingFixture.configBase64, 'base64'),
      ),
    )
    const opened = toMigratedPool(parameters, toPoolConfig(parameters))
    expect(opened.collectFeeMode).toBe(CollectFeeMode.Compounding)
    expect(opened.poolFees.compoundingFeeBps).toBe(1000)
    expect({
      liquidity: opened.liquidity.toString(),
      sqrtPrice: opened.sqrtPrice.toString(),
      reserveA: opened.tokenAAmount.toString(),
      reserveB: opened.tokenBAmount.toString(),
    }).toEqual({
      liquidity: chain.liquidity,
      sqrtPrice: chain.sqrtPrice,
      reserveA: chain.reserveA,
      reserveB: chain.reserveB,
    })
  })

  const opened = toMigratedPool(
    compoundingParameters,
    toPoolConfig(compoundingParameters),
  )

  it('keeps the compounding share of a buy in its quote reserve', () => {
    const swap = quoteMigratedSwap(opened, false, new BN(1_000_000_000), 0)
    const after = afterMigratedSwap(opened, swap)
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
    const pool = toMigratedPool(unlocked, toPoolConfig(unlocked))
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
