import BN from 'bn.js'
import { describe, expect, it } from 'vitest'
import {
  decodePodAlignedFeeTimeScheduler,
  getPriceFromSqrtPrice,
} from '@meteora-ag/cp-amm-sdk'
import {
  DammV2DynamicFeeMode,
  MigratedCollectFeeMode,
  MigrationFeeOption,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { compileLaunchConfig, DEFAULT_LAUNCH_CONFIG } from '../launch-config'
import type { LaunchConfig } from '../launch-config'
import { toPoolConfig } from '../launch-simulator/utils'
import {
  migratedFeeBps,
  migratedUnsupportedReason,
  quoteMigratedSwap,
  toMigratedPool,
} from '.'

const compile = (config: LaunchConfig) => {
  const compiled = compileLaunchConfig(config)
  if (!compiled.ok) throw new Error(compiled.reason)
  return compiled.parameters
}

const parameters = compile(DEFAULT_LAUNCH_CONFIG)
const pool = toMigratedPool(parameters, toPoolConfig(parameters))
const BASE_DECIMALS = DEFAULT_LAUNCH_CONFIG.token.tokenBaseDecimal

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

  it('refuses compounding fees and the dynamic fee on the migrated pool', () => {
    const customizable = {
      ...DEFAULT_LAUNCH_CONFIG,
      migration: {
        ...DEFAULT_LAUNCH_CONFIG.migration,
        migrationFeeOption: MigrationFeeOption.Customizable,
      },
    }
    expect(
      migratedUnsupportedReason({
        ...parameters,
        migratedPoolFee: {
          collectFeeMode: MigratedCollectFeeMode.Compounding,
          dynamicFee: 0,
          poolFeeBps: 100,
        },
      }),
    ).not.toBeNull()
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
})
