import { BaseFeeMode } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { QuoteToken } from '../quote-token'
import { CurveShape, DEFAULT_LAUNCH_CONFIG, LaunchPresetId } from './constants'
import { withCurve, withQuoteToken } from './curve'
import { FLAT_FEE_BPS, withSchedule } from './fee-schedule'
import type { LaunchPreset } from './types'

/**
 * Built-in configs for side-by-side comparison. The fee schedules were chosen from a sweep
 * over 20 seeded scenarios: a short, steep window hurts first-second bots most while leaving
 * later buyers untouched; a long window taxes humans too. The stock listing's market caps
 * came from a sweep under the tokenized-stock situation (10 seeds, 300 SOL outside price):
 * opening at 250 graduates every time and leaves arbitrage traders ~12 SOL, against ~139
 * for a curve opening near 20.
 */
export const LAUNCH_PRESETS: LaunchPreset[] = [
  {
    id: LaunchPresetId.Flat,
    name: 'Flat 1%',
    intent: 'Baseline: the same fee for everyone, as on most meme launchpads.',
    config: DEFAULT_LAUNCH_CONFIG,
  },
  {
    id: LaunchPresetId.SniperShield,
    name: 'Sniper shield',
    intent:
      'Fee falls from 90% to 1% over the first 10 seconds, so buying in the opening second costs a bot most of its stake.',
    config: withSchedule(DEFAULT_LAUNCH_CONFIG, {
      mode: BaseFeeMode.FeeSchedulerLinear,
      startingFeeBps: 9000,
      endingFeeBps: FLAT_FEE_BPS,
      windowSeconds: 10,
    }),
  },
  {
    id: LaunchPresetId.SoftOpen,
    name: 'Soft open',
    intent:
      'Fee falls from 50% to 1% over 5 seconds on an exponential curve: a milder deterrent that keeps early buys affordable.',
    config: withSchedule(DEFAULT_LAUNCH_CONFIG, {
      mode: BaseFeeMode.FeeSchedulerExponential,
      startingFeeBps: 5000,
      endingFeeBps: FLAT_FEE_BPS,
      windowSeconds: 5,
    }),
  },
  {
    id: LaunchPresetId.LongTax,
    name: 'Long tax',
    intent:
      'Fee falls from 50% to 1% over a full minute. Shown as a warning: it punishes bots, but early human buyers pay too.',
    config: withSchedule(DEFAULT_LAUNCH_CONFIG, {
      mode: BaseFeeMode.FeeSchedulerLinear,
      startingFeeBps: 5000,
      endingFeeBps: FLAT_FEE_BPS,
      windowSeconds: 60,
    }),
  },
  {
    id: LaunchPresetId.StockListing,
    name: 'Stock listing (USDC)',
    intent:
      'Opens at a 37,500 USDC market cap, just under a tokenized name’s ~45,000 USDC (300 SOL) outside price, so traders who know that price have little gap to take.',
    config: withQuoteToken(
      withCurve(DEFAULT_LAUNCH_CONFIG, {
        curveShape: CurveShape.MarketCap,
        initialMarketCap: 250,
        migrationMarketCap: 300,
      }),
      QuoteToken.Usdc,
    ),
  },
]
