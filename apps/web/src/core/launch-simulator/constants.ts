export enum TradeSide {
  Buy = 'buy',
  Sell = 'sell',
  /** Sell the trader's whole holding, whatever it is at that moment. */
  SellAll = 'sell-all',
}

export enum TradeStatus {
  Filled = 'filled',
  PartiallyFilled = 'partially-filled',
  Rejected = 'rejected',
}

export enum FeeToken {
  Quote = 'quote',
  Base = 'base',
}

/** Where a trade executed: on the bonding curve, or on the pool it migrated to. */
export enum Venue {
  Curve = 'curve',
  Migrated = 'migrated',
}

/** Solana's target slot time, used to turn scenario seconds into slots for slot-activated configs. */
export const SLOT_DURATION_MS = 400
