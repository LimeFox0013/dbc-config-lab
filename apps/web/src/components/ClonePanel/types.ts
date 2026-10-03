import type { LiquiditySplit } from '../../core/config-deploy'
import type { OnChainConfig } from '../../features/onchain-config'

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
