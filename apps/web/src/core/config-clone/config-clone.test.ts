import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ActivationType,
  BaseFeeMode,
  MigrationOption,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { PoolConfig } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { createDbcProgram } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { describe, expect, it } from 'vitest'
import { connectionFor } from '../config-deploy'
import { compileLaunchConfig, LAUNCH_PRESETS } from '../launch-config'
import { feeScheduleOf } from '../launch-simulator'
import { fromPoolConfig } from '../onchain-config'
import { clonedParameters, cloneRefusal } from '.'
import { CLONE_REASONS } from './constants'
import { SolanaNetwork } from '../shared'

const compiledPreset = (id: string) => {
  const preset = LAUNCH_PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`No preset ${id}`)
  const compiled = compileLaunchConfig(preset.config)
  if (!compiled.ok) throw new Error(compiled.reason)
  return compiled.parameters
}

const mainnetConfig = () => {
  const fixture: { configBase64: string } = JSON.parse(
    readFileSync(
      join(__dirname, '../migrated-pool/fixtures/compounding-migration.json'),
      'utf8',
    ),
  )
  const config: PoolConfig = createDbcProgram(
    connectionFor(SolanaNetwork.Mainnet),
  ).program.coder.accounts.decode(
    'poolConfig',
    Buffer.from(fixture.configBase64, 'base64'),
  )
  return fromPoolConfig(config)
}

describe('clonedParameters', () => {
  it('copies a real mainnet config unchanged when nothing is adjusted', () => {
    const original = mainnetConfig()
    expect(clonedParameters(original, {})).toEqual({
      ok: true,
      parameters: original,
    })
  })

  it('applies a new fee schedule, exact in the config’s own time units', () => {
    const original = compiledPreset('flat')
    const feeSchedule = {
      startingFeeBps: 5000,
      endingFeeBps: 100,
      windowSeconds: 60,
    }
    const clone = clonedParameters(original, { feeSchedule })
    if (!clone.ok) throw new Error(clone.reason)
    expect(feeScheduleOf(clone.parameters)).toMatchObject(feeSchedule)
    expect(clone.parameters.curve).toEqual(original.curve)

    const slotClone = clonedParameters(
      { ...original, activationType: ActivationType.Slot },
      { feeSchedule },
    )
    if (!slotClone.ok) throw new Error(slotClone.reason)
    expect(feeScheduleOf(slotClone.parameters)?.windowSeconds).toBe(60)
  })

  it('applies the creator share, liquidity split and first-buy fee', () => {
    const original = compiledPreset('sniper-shield')
    const liquidity = {
      partnerPercentage: 0,
      partnerLockedPercentage: 50,
      creatorPercentage: 0,
      creatorLockedPercentage: 50,
    }
    const clone = clonedParameters(original, {
      creatorTradingFeePercentage: 30,
      liquidity,
      firstBuyAtMinimumFee: !original.enableFirstSwapWithMinFee,
    })
    if (!clone.ok) throw new Error(clone.reason)
    expect(clone.parameters).toMatchObject({
      creatorTradingFeePercentage: 30,
      partnerLiquidityPercentage: 0,
      partnerPermanentLockedLiquidityPercentage: 50,
      creatorLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 50,
      enableFirstSwapWithMinFee: !original.enableFirstSwapWithMinFee,
    })
  })

  it('refuses numbers the program would store differently from what is shown', () => {
    const original = compiledPreset('flat')
    const refused = { ok: false, reason: CLONE_REASONS.wholeNumbers }
    expect(
      clonedParameters(original, { creatorTradingFeePercentage: 30.7 }),
    ).toEqual(refused)
    expect(
      clonedParameters(original, { creatorTradingFeePercentage: Number.NaN }),
    ).toEqual(refused)
    expect(
      clonedParameters(original, {
        feeSchedule: {
          startingFeeBps: 5000,
          endingFeeBps: 100,
          windowSeconds: 10.5,
        },
      }),
    ).toEqual(refused)
  })

  it('reports a fee window the SDK cannot build instead of throwing', () => {
    const clone = clonedParameters(compiledPreset('flat'), {
      feeSchedule: {
        startingFeeBps: 5000,
        endingFeeBps: 100,
        windowSeconds: 0,
      },
    })
    expect(clone.ok).toBe(false)
  })

  it('refuses adjustments the DBC program would reject, with its reason', () => {
    const clone = clonedParameters(compiledPreset('flat'), {
      liquidity: {
        partnerPercentage: 50,
        partnerLockedPercentage: 0,
        creatorPercentage: 0,
        creatorLockedPercentage: 0,
      },
    })
    expect(clone).toMatchObject({ ok: false })
    if (clone.ok) return
    expect(clone.reason).toMatch(/100/)
  })
})

describe('a config the program would reject today', () => {
  // Older launchpads could leave all graduation liquidity unlocked; new configs may not.
  const unlocked = {
    ...compiledPreset('flat'),
    partnerLiquidityPercentage: 50,
    partnerPermanentLockedLiquidityPercentage: 0,
    creatorLiquidityPercentage: 50,
    creatorPermanentLockedLiquidityPercentage: 0,
  }

  it('can still be cloned once adjusted to pass', () => {
    expect(cloneRefusal(unlocked)).toBeNull()
    expect(clonedParameters(unlocked, {})).toMatchObject({ ok: false })
    expect(
      clonedParameters(unlocked, {
        liquidity: {
          partnerPercentage: 40,
          partnerLockedPercentage: 10,
          creatorPercentage: 50,
          creatorLockedPercentage: 0,
        },
      }),
    ).toMatchObject({ ok: true })
  })
})

describe('cloneRefusal', () => {
  const flat = compiledPreset('flat')

  it('accepts every built-in preset', () => {
    LAUNCH_PRESETS.forEach((preset) =>
      expect(cloneRefusal(compiledPreset(preset.id))).toBeNull(),
    )
  })

  it('refuses terms new configs may no longer use', () => {
    expect(
      cloneRefusal({
        ...flat,
        poolFees: {
          ...flat.poolFees,
          baseFee: {
            ...flat.poolFees.baseFee,
            baseFeeMode: BaseFeeMode.RateLimiter,
          },
        },
      }),
    ).toMatch(/deprecated/)
    expect(
      cloneRefusal({ ...flat, migrationOption: MigrationOption.MET_DAMM }),
    ).toMatch(/deprecated/)
  })
})
