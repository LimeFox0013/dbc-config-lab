import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { connectionFor } from '../core/config-deploy'
import {
  Criterion,
  DEFAULT_SEARCH_SEEDS,
  objectiveOf,
} from '../core/config-search'
import { LAUNCH_PRESETS, LaunchPresetId } from '../core/launch-config'
import { SCENARIO_PRESETS, ScenarioPresetId } from '../core/sniper-scenario'
import type { ScenarioSpec } from '../core/sniper-scenario'
import { compareConfigs } from '../features/comparison'
import type { ComparisonEntry } from '../features/comparison'
import {
  encodeSharedConfig,
  shareLink,
  toTypeScript,
} from '../features/config-sharing'
import { loadLaunchpads, rankLaunchpads } from '../features/launchpad-economics'
import {
  configReport,
  simulationOf,
  typicalLaunchRow,
} from '../features/config-report'
import {
  LaunchPageStatus,
  readLaunchPage,
  reportPagePath,
} from '../features/launch-page'
import { fetchRealLaunches } from '../features/real-launches'
import {
  GOAL_OBJECTIVES,
  LaunchGoal,
  matchingPreset,
  recommend,
} from '../features/recommendation'
import en from '../locales/en.json'
import {
  ConfigSource,
  DEFAULT_LAB_URL,
  LAB_URL_ENV,
  MCP_TEXT,
  ToolName,
} from './constants'
import {
  compareInput,
  exportInput,
  findLaunchpadsInput,
  loadOnChainInput,
  recommendInput,
} from './schemas'
import {
  launchpadSummary,
  resolveDesign,
  resolveEntry,
  rowSummary,
  toolRefusal,
  toolResult,
} from './utils'

const READ_ONLY = { readOnlyHint: true, destructiveHint: false } as const

const labUrl = (): string => process.env[LAB_URL_ENV] ?? DEFAULT_LAB_URL

type Situation =
  { ok: true; scenario: ScenarioSpec } | { ok: false; reason: string }

/** The situation's spec, with a seed and an outside price when given. */
const scenarioFor = (
  situation: ScenarioPresetId,
  options: { seed?: number; outsideMarketCapSol?: number },
): Situation => {
  const preset = SCENARIO_PRESETS[situation]
  if (
    options.outsideMarketCapSol !== undefined &&
    preset.arbitrageurs.count === 0
  )
    return { ok: false, reason: MCP_TEXT.noArbitrageurs }
  return {
    ok: true,
    scenario: {
      ...preset,
      ...(options.seed === undefined ? {} : { seed: options.seed }),
      arbitrageurs: {
        ...preset.arbitrageurs,
        ...(options.outsideMarketCapSol === undefined
          ? {}
          : { fairMarketCapSol: options.outsideMarketCapSol }),
      },
    },
  }
}

/** Registers the lab's read-only tools: nothing here signs, sends or stores anything. */
export const registerTools = (server: McpServer): void => {
  server.registerTool(
    ToolName.ListOptions,
    {
      title: 'List lab options',
      description:
        'The built-in launch config presets, launch situations (who trades a launch and when), recommender goals and criteria the other tools accept.',
      annotations: { ...READ_ONLY, openWorldHint: false },
    },
    () =>
      toolResult({
        presets: LAUNCH_PRESETS.map(({ id, name, intent }) => ({
          id,
          name,
          intent,
        })),
        situations: Object.values(ScenarioPresetId).map((id) => ({
          id,
          ...en.components.scenarioControls.presets[id],
          spec: SCENARIO_PRESETS[id],
        })),
        goals: Object.values(LaunchGoal).map((id) => ({
          id,
          name: en.components.recommenderPanel.goals[id],
          weights: GOAL_OBJECTIVES[id],
        })),
        criteria: Object.values(Criterion),
      }),
  )

  server.registerTool(
    ToolName.CompareConfigs,
    {
      title: 'Compare launch configs',
      description:
        'Simulates one launch situation against each config — the bonding curve with the DBC SDK’s own swap math, then the DAMM v2 pool it graduates into — and reports who profited and who paid (snipers, patient bots, humans, arbitrage traders, partner/creator fees), graduation, raise, price path and the share of graduation liquidity that can be pulled. Amounts are in SOL.',
      inputSchema: compareInput,
      annotations: { ...READ_ONLY, openWorldHint: true },
    },
    async ({ configs, situation, seed, outsideMarketCapSol }) => {
      const run = scenarioFor(situation, { seed, outsideMarketCapSol })
      if (!run.ok) return toolRefusal(run.reason)
      const resolved = await Promise.all(configs.map(resolveEntry))
      const refused = resolved.flatMap((result, index) =>
        result.ok ? [] : [`configs[${index}]: ${result.reason}`],
      )
      if (refused.length > 0) return toolRefusal(refused.join('\n'))
      const entries = resolved.flatMap((result): ComparisonEntry[] =>
        result.ok ? [result.entry] : [],
      )
      const { scenario } = run
      return toolResult({
        situation,
        seed: scenario.seed,
        outsideMarketCapSol:
          scenario.arbitrageurs.count > 0
            ? scenario.arbitrageurs.fairMarketCapSol
            : null,
        caveat: MCP_TEXT.singleSeedCaveat,
        rows: compareConfigs(entries, scenario).map(rowSummary),
      })
    },
  )

  server.registerTool(
    ToolName.RecommendConfig,
    {
      title: 'Recommend a launch config',
      description:
        'Searches fee schedules (and optionally curve shapes) for the config that best serves a goal in a launch situation, ranking every candidate by simulation over several seeds. Returns the top proposals with their figures, how each compares with a flat 1% fee, and a share string usable as a "shared" config in the other tools.',
      inputSchema: recommendInput,
      annotations: { ...READ_ONLY, openWorldHint: false },
    },
    ({
      goal,
      weights,
      base,
      situation,
      outsideMarketCapSol,
      includeCurves,
    }) => {
      if ((goal === undefined) === (weights === undefined))
        return toolRefusal(MCP_TEXT.goalOrWeights)
      const run = scenarioFor(situation, { outsideMarketCapSol })
      if (!run.ok) return toolRefusal(run.reason)
      const design = resolveDesign(
        base ?? { source: ConfigSource.Preset, id: LaunchPresetId.Flat },
      )
      if (!design.ok) return toolRefusal(design.reason)
      const recommendation = recommend(
        design.shared.config,
        goal === undefined ? objectiveOf(weights ?? {}) : GOAL_OBJECTIVES[goal],
        run.scenario,
        { includeCurves },
      )
      if (!recommendation) return toolRefusal(MCP_TEXT.noFlatBaseline)
      return toolResult({
        situation,
        outsideMarketCapSol:
          run.scenario.arbitrageurs.count > 0
            ? run.scenario.arbitrageurs.fairMarketCapSol
            : null,
        seeds: DEFAULT_SEARCH_SEEDS,
        caveat: MCP_TEXT.searchSeedsCaveat,
        undecided: recommendation.undecided,
        indistinguishable: recommendation.indistinguishable,
        flat: recommendation.flat,
        proposals: recommendation.proposals.map(
          ({ rank, candidate, versusFlat }) => ({
            rank,
            score: candidate.score,
            schedule: candidate.schedule,
            curve: candidate.curve,
            matchesPreset:
              matchingPreset(candidate.config, LAUNCH_PRESETS)?.id ?? null,
            metrics: candidate.metrics,
            versusFlat,
            shared: encodeSharedConfig({ config: candidate.config }),
          }),
        ),
      })
    },
  )

  server.registerTool(
    ToolName.LoadOnChainConfig,
    {
      title: 'Load an on-chain DBC config',
      description:
        'The config report for a DBC config on Solana, by its address or the address of a pool launched on it: its terms in plain fields, the risks they leave open to a buyer (withdrawable graduation liquidity, mint or metadata authority kept, no automatic graduation, terms the SDK no longer accepts), the operator’s self-published (unverified) branding, how the real launches on it went (read from chain, optional), and a simulated typical launch — the same report as the lab’s /config page. Public RPC; nothing is signed.',
      inputSchema: loadOnChainInput,
      annotations: { ...READ_ONLY, openWorldHint: true },
    },
    async ({ address, network, includeRealLaunches }) => {
      const connection = connectionFor(network)
      const read = await readLaunchPage(connection, network, address)
      if (read.status !== LaunchPageStatus.Ready)
        return toolRefusal(
          read.detail ? `${read.rejection}: ${read.detail}` : read.rejection,
        )
      const { config, branding, royalty } = read
      const real = includeRealLaunches
        ? await fetchRealLaunches(
            connection,
            config.configAddress,
            config.parameters,
            config.quoteToken,
          )
        : null
      return toolResult({
        report: configReport(config, {
          branding,
          royalty,
          real,
          simulated: simulationOf(
            typicalLaunchRow(config, MCP_TEXT.typicalLaunchName),
          ),
        }),
        reportPage: new URL(
          reportPagePath(config.configAddress, config.network),
          labUrl(),
        ).toString(),
        compareAs: {
          source: ConfigSource.OnChain,
          address: config.configAddress,
          network: config.network,
        },
      })
    },
  )

  server.registerTool(
    ToolName.ExportConfig,
    {
      title: 'Export a launch config',
      description:
        'The full config object (editable and passable back as a "config" source), a lab share link that reopens it, and ready-to-run TypeScript that creates it on chain with the Meteora DBC SDK.',
      inputSchema: exportInput,
      annotations: { ...READ_ONLY, openWorldHint: false },
    },
    ({ config }) => {
      const design = resolveDesign(config)
      if (!design.ok) return toolRefusal(design.reason)
      return toolResult({
        name: design.label.name,
        config: design.shared.config,
        royalty: design.shared.royalty ?? null,
        shareLink: shareLink(design.shared, labUrl()),
        typescript: toTypeScript(design.shared.config),
        note: MCP_TEXT.signingNote,
      })
    },
  )

  server.registerTool(
    ToolName.FindLaunchpads,
    {
      title: 'Find real launchpads',
      description:
        'The most-graduated real launchpad configs on Solana mainnet and what their launches earned, from the lab’s chain snapshot: filter by the terms a builder picks and sort by partner income per launch, graduation rate or launch count. Each result can be compared as an on-chain config.',
      inputSchema: findLaunchpadsInput,
      annotations: { ...READ_ONLY, openWorldHint: false },
    },
    async ({ sort, limit, ...filter }) => {
      const records = rankLaunchpads(await loadLaunchpads(), { sort, filter })
      return toolResult({
        matched: records.length,
        takenAt: records[0]?.takenAt ?? null,
        launchpads: records.slice(0, limit).map(launchpadSummary),
      })
    },
  )
}
