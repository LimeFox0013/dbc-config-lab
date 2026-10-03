import type { ScenarioSpec } from './types'

/** Buys in this many seconds after launch count as "early" for the fairness measure. */
export const EARLY_WINDOW_SECONDS = 60

export enum TraderGroup {
  Sniper = 'sniper',
  AdaptiveSniper = 'adaptive-sniper',
  Human = 'human',
  Arbitrageur = 'arbitrageur',
}

/** Separates group and index in a trader id, e.g. `adaptive-sniper:3`. */
export const TRADER_ID_SEPARATOR = ':'

/** Five bots buying in the first two seconds and dumping 30s later; sixty humans over ten minutes. */
export const DEFAULT_SCENARIO: ScenarioSpec = {
  seed: 42,
  snipers: {
    count: 5,
    buyWithinSeconds: 2,
    solPerBuy: { min: 1, max: 3 },
    holdSeconds: 30,
  },
  humans: {
    count: 60,
    arriveFromSeconds: 3,
    arriveUntilSeconds: 600,
    solPerBuy: { min: 0.1, max: 2 },
  },
  adaptiveSnipers: {
    count: 0,
    maxFeeBps: 200,
    maxWaitSeconds: 120,
    solPerBuy: { min: 1, max: 3 },
    holdSeconds: 30,
  },
  arbitrageurs: {
    count: 0,
    fairMarketCapSol: 300,
    checkEverySeconds: 5,
    untilSeconds: 1800,
    gapBps: 200,
    solPerTrade: { min: 1, max: 3 },
  },
  unlockedLiquidityPulled: false,
}

export enum ScenarioPresetId {
  Typical = 'typical',
  Hype = 'hype',
  SlowBurn = 'slow-burn',
  PatientBots = 'patient-bots',
  StockListing = 'stock-listing',
}

/** Distinct launch situations; names and descriptions live in the UI's locale files. */
export const SCENARIO_PRESETS: Record<ScenarioPresetId, ScenarioSpec> = {
  [ScenarioPresetId.Typical]: DEFAULT_SCENARIO,
  [ScenarioPresetId.Hype]: {
    seed: 42,
    snipers: {
      count: 15,
      buyWithinSeconds: 1,
      solPerBuy: { min: 1, max: 5 },
      holdSeconds: 20,
    },
    humans: {
      count: 200,
      arriveFromSeconds: 2,
      arriveUntilSeconds: 180,
      solPerBuy: { min: 0.2, max: 3 },
    },
    adaptiveSnipers: { ...DEFAULT_SCENARIO.adaptiveSnipers, count: 5 },
    arbitrageurs: DEFAULT_SCENARIO.arbitrageurs,
    unlockedLiquidityPulled: false,
  },
  [ScenarioPresetId.SlowBurn]: {
    seed: 42,
    snipers: {
      count: 2,
      buyWithinSeconds: 2,
      solPerBuy: { min: 0.5, max: 2 },
      holdSeconds: 60,
    },
    humans: {
      count: 40,
      arriveFromSeconds: 3,
      arriveUntilSeconds: 3600,
      solPerBuy: { min: 0.1, max: 1.5 },
    },
    adaptiveSnipers: { ...DEFAULT_SCENARIO.adaptiveSnipers, count: 2 },
    arbitrageurs: DEFAULT_SCENARIO.arbitrageurs,
    unlockedLiquidityPulled: false,
  },
  [ScenarioPresetId.PatientBots]: {
    ...DEFAULT_SCENARIO,
    snipers: { ...DEFAULT_SCENARIO.snipers, count: 0 },
    adaptiveSnipers: { ...DEFAULT_SCENARIO.adaptiveSnipers, count: 8 },
  },
  /** A newly tokenized name with an outside price: thin human demand, traders who know the price. */
  [ScenarioPresetId.StockListing]: {
    ...DEFAULT_SCENARIO,
    snipers: { ...DEFAULT_SCENARIO.snipers, count: 3 },
    humans: {
      count: 30,
      arriveFromSeconds: 3,
      arriveUntilSeconds: 1800,
      solPerBuy: { min: 0.2, max: 2 },
    },
    arbitrageurs: { ...DEFAULT_SCENARIO.arbitrageurs, count: 3 },
  },
}
