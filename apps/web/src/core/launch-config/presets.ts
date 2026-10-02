import { BaseFeeMode } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { DEFAULT_LAUNCH_CONFIG } from './constants'
import { FLAT_FEE_BPS, withSchedule } from './fee-schedule'
import type { LaunchPreset } from './types'

/**
 * Built-in configs for side-by-side comparison. Chosen from a fee-schedule sweep over 20
 * seeded scenarios: a short, steep window hurts first-second bots most while leaving later
 * buyers untouched; a long window taxes humans too.
 */
export const LAUNCH_PRESETS: LaunchPreset[] = [
  {
    id: 'flat',
    name: 'Flat 1%',
    intent: 'Baseline: the same fee for everyone, as on most meme launchpads.',
    config: DEFAULT_LAUNCH_CONFIG,
  },
  {
    id: 'sniper-shield',
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
    id: 'soft-open',
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
    id: 'long-tax',
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
]
