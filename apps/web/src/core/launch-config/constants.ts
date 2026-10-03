import { PublicKey } from '@solana/web3.js'
import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { QUOTE_TOKENS, QuoteToken } from '../quote-token'
import type { LaunchConfig } from './types'

export const SOL_DECIMALS = QUOTE_TOKENS[QuoteToken.Sol].decimals

export enum CurveShape {
  Standard = 'standard',
  MarketCap = 'market-cap',
  TwoSegments = 'two-segments',
  LiquidityWeights = 'liquidity-weights',
}

/** A pump.fun-like baseline: 1B supply, 85 SOL graduation, flat 1% fee. */
export const DEFAULT_LAUNCH_CONFIG: LaunchConfig = {
  token: {
    tokenType: TokenType.SPLToken,
    tokenBaseDecimal: TokenDecimal.SIX,
    tokenQuoteDecimal: SOL_DECIMALS,
    tokenAuthorityOption: TokenAuthorityOption.Immutable,
    totalTokenSupply: 1_000_000_000,
    leftover: 0,
  },
  fee: {
    baseFeeParams: {
      baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
      feeSchedulerParam: {
        startingFeeBps: 100,
        endingFeeBps: 100,
        numberOfPeriod: 0,
        totalDuration: 0,
      },
    },
    dynamicFeeEnabled: false,
    collectFeeMode: CollectFeeMode.QuoteToken,
    creatorTradingFeePercentage: 50,
    poolCreationFee: 0,
    enableFirstSwapWithMinFee: false,
  },
  migration: {
    migrationOption: MigrationOption.MET_DAMM_V2,
    migrationFeeOption: MigrationFeeOption.FixedBps100,
    migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
  },
  liquidityDistribution: {
    partnerLiquidityPercentage: 0,
    partnerPermanentLockedLiquidityPercentage: 50,
    creatorLiquidityPercentage: 0,
    creatorPermanentLockedLiquidityPercentage: 50,
  },
  lockedVesting: {
    totalLockedVestingAmount: 0,
    numberOfVestingPeriod: 0,
    cliffUnlockAmount: 0,
    totalVestingDuration: 0,
    cliffDurationFromMigrationTime: 0,
  },
  activationType: ActivationType.Timestamp,
  quoteToken: QuoteToken.Sol,
  curveShape: CurveShape.Standard,
  percentageSupplyOnMigration: 20,
  migrationQuoteThreshold: 85,
}

/** Stand-in leftover receiver for validation; the real one is the deployer's wallet. */
export const VALIDATION_LEFTOVER_RECEIVER = new PublicKey(1)
