import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { LiquiditySplit } from '../config-deploy'
import type { FeeSchedule } from '../launch-config'

/** Terms a clone may change; none of them reshapes the bonding curve. Unset keeps the original's. */
export interface CloneAdjustments {
  /** Keeps the original's schedule mode; the window is in seconds. */
  feeSchedule?: Omit<FeeSchedule, 'mode'>
  creatorTradingFeePercentage?: number
  liquidity?: LiquiditySplit
  firstBuyAtMinimumFee?: boolean
}

export type CloneResult =
  { ok: true; parameters: ConfigParameters } | { ok: false; reason: string }
