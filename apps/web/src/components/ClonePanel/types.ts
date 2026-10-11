import type { LiquiditySplit } from '@dbc-config-lab/core/core/config-deploy'
import type { OnChainConfig } from '@dbc-config-lab/core/features/onchain-config'

export interface ClonePanelProps {
  /** Real configs in the comparison, newest first. */
  originals: OnChainConfig[]
}

/** The clone form; fees in percent, the window in seconds. */
export interface CloneForm {
  startingFeePercent: number
  endingFeePercent: number
  windowSeconds: number
  creatorTradingFeePercentage: number
  liquidity: LiquiditySplit
  firstBuyAtMinimumFee: boolean
}
