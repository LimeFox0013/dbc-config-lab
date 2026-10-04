import { z } from 'zod'
import { LaunchPresetId } from '../core/launch-config'
import { QuoteToken } from '../core/quote-token'
import { SolanaNetwork } from '../core/shared'
import { ScenarioPresetId } from '../core/sniper-scenario'
import { Criterion } from '../core/config-search'
import { MAX_SHARE_LENGTH } from '../features/config-sharing'
import { MAX_ADDRESS_LENGTH } from '../features/onchain-config'
import { SCENARIO_LIMITS } from '../features/comparison'
import {
  CreatorShareBand,
  FeeShape,
  LaunchpadSort,
  ThresholdBand,
} from '../features/launchpad-economics'
import { LaunchGoal } from '../features/recommendation'
import {
  ConfigSource,
  DEFAULT_LAUNCHPADS_RETURNED,
  MAX_COMPARED_CONFIGS,
  MAX_LAUNCHPADS_RETURNED,
} from './constants'

const presetRef = z.object({
  source: z.literal(ConfigSource.Preset),
  id: z.nativeEnum(LaunchPresetId),
})

const sharedRef = z.object({
  source: z.literal(ConfigSource.Shared),
  link: z
    .string()
    .max(MAX_SHARE_LENGTH * 2)
    .describe(
      'A lab share link, or just its encoded config (the "shared" value other tools return).',
    ),
})

const configRef = z.object({
  source: z.literal(ConfigSource.Config),
  config: z
    .record(z.unknown())
    .describe(
      'A full launch config object, as export_config returns it. Validated by the DBC program’s own rules.',
    ),
  name: z.string().max(60).optional(),
})

const onChainRef = z.object({
  source: z.literal(ConfigSource.OnChain),
  address: z
    .string()
    .max(MAX_ADDRESS_LENGTH)
    .describe(
      'A DBC config address, or the address of a pool launched on one.',
    ),
  network: z.nativeEnum(SolanaNetwork).default(SolanaNetwork.Mainnet),
})

/** A config the lab can design with: everything but a config read from chain. */
export const designConfigSchema = z
  .discriminatedUnion('source', [presetRef, sharedRef, configRef])
  .describe('A built-in preset, a share link, or a full config object.')

export const anyConfigSchema = z
  .discriminatedUnion('source', [presetRef, sharedRef, configRef, onChainRef])
  .describe(
    'A built-in preset, a share link, a full config object, or a config on chain.',
  )

const situation = z
  .nativeEnum(ScenarioPresetId)
  .default(ScenarioPresetId.Typical)
  .describe(
    'The launch situation traded against each config; see list_options.',
  )

const seed = z
  .number()
  .int()
  .min(0)
  .max(SCENARIO_LIMITS.maxSeed)
  .optional()
  .describe(
    'Seed for the trader timing and sizes; defaults to the situation’s own. One seed is one possible launch — rerun with others before drawing conclusions.',
  )

const outsideMarketCapSol = z
  .number()
  .min(SCENARIO_LIMITS.minFairMarketCapSol)
  .max(SCENARIO_LIMITS.maxFairMarketCapSol)
  .optional()
  .describe(
    'The outside market cap, in SOL, that the situation’s arbitrage traders know (a tokenized name’s real price × the token supply). Only for situations with arbitrage traders, such as stock-listing.',
  )

export const compareInput = {
  configs: z.array(anyConfigSchema).min(1).max(MAX_COMPARED_CONFIGS),
  situation,
  seed,
  outsideMarketCapSol,
}

export const recommendInput = {
  goal: z
    .nativeEnum(LaunchGoal)
    .optional()
    .describe('A named goal; see list_options. Give this or weights.'),
  weights: z
    .record(z.nativeEnum(Criterion), z.number().min(0).max(1))
    .optional()
    .describe(
      'Custom criterion weights 0–1, for a goal no named one fits. Give this or goal.',
    ),
  base: designConfigSchema
    .optional()
    .describe(
      'The config whose curve and terms are kept while fee schedules are searched; defaults to the flat preset.',
    ),
  situation,
  outsideMarketCapSol,
  includeCurves: z
    .boolean()
    .default(false)
    .describe(
      'Also try other curve shapes and graduation thresholds, on a coarser fee grid. Slower. With arbitrage traders in the situation, tries curves opening below and graduating near their outside price instead.',
    ),
}

export const loadOnChainInput = {
  address: onChainRef.shape.address,
  network: onChainRef.shape.network,
  includeRealLaunches: z
    .boolean()
    .default(true)
    .describe(
      'Also read every pool launched on the config (up to 500) and summarise how those launches went.',
    ),
}

export const exportInput = {
  config: designConfigSchema,
}

export const findLaunchpadsInput = {
  sort: z.nativeEnum(LaunchpadSort).default(LaunchpadSort.PartnerIncome),
  quoteToken: z.nativeEnum(QuoteToken).optional(),
  thresholdBand: z.nativeEnum(ThresholdBand).optional(),
  feeShape: z.nativeEnum(FeeShape).optional(),
  creatorShare: z.nativeEnum(CreatorShareBand).optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_LAUNCHPADS_RETURNED)
    .default(DEFAULT_LAUNCHPADS_RETURNED),
}

export type DesignConfigRef = z.infer<typeof designConfigSchema>
export type AnyConfigRef = z.infer<typeof anyConfigSchema>
