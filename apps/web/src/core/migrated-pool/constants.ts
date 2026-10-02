import { MigrationFeeOption } from '@meteora-ag/dynamic-bonding-curve-sdk'

/** Trading fee of the DAMM v2 pool a fixed-fee migration option creates. */
export const FIXED_MIGRATED_FEE_BPS: Partial<
  Record<MigrationFeeOption, number>
> = {
  [MigrationFeeOption.FixedBps25]: 25,
  [MigrationFeeOption.FixedBps30]: 30,
  [MigrationFeeOption.FixedBps100]: 100,
  [MigrationFeeOption.FixedBps200]: 200,
  [MigrationFeeOption.FixedBps400]: 400,
  [MigrationFeeOption.FixedBps600]: 600,
}

/**
 * Share of the migrated quote the DBC program keeps as its protocol fee when it opens the
 * DAMM v2 pool (program constant PROTOCOL_LIQUIDITY_MIGRATION_FEE_BPS; not exported by the SDK).
 */
export const PROTOCOL_LIQUIDITY_MIGRATION_FEE_BPS = 20

/** DAMM v2 protocol and referral shares of a trading fee, in percent. */
export const MIGRATED_PROTOCOL_FEE_PERCENT = 20
export const MIGRATED_REFERRAL_FEE_PERCENT = 20

/** Every quote here is priced in SOL. */
export const QUOTE_DECIMALS = 9
