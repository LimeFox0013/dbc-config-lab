import type { ScenarioSpec } from './types'

export const LAMPORTS_PER_SOL = 1_000_000_000

/** Buys in this many seconds after launch count as "early" for the fairness measure. */
export const EARLY_WINDOW_SECONDS = 60

export enum TraderGroup {
  Sniper = 'sniper',
  AdaptiveSniper = 'adaptive-sniper',
  Human = 'human',
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
}

export enum ScenarioPresetId {
  Typical = 'typical',
  Hype = 'hype',
  SlowBurn = 'slow-burn',
  PatientBots = 'patient-bots',
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
  },
  [ScenarioPresetId.PatientBots]: {
    ...DEFAULT_SCENARIO,
    snipers: { ...DEFAULT_SCENARIO.snipers, count: 0 },
    adaptiveSnipers: { ...DEFAULT_SCENARIO.adaptiveSnipers, count: 8 },
  },
}
