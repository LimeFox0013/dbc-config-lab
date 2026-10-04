export const SERVER_INFO = { name: 'dbc-config-lab', version: '0.1.0' } as const

export enum ToolName {
  ListOptions = 'list_options',
  CompareConfigs = 'compare_configs',
  RecommendConfig = 'recommend_config',
  LoadOnChainConfig = 'load_onchain_config',
  ExportConfig = 'export_config',
  FindLaunchpads = 'find_launchpads',
}

/** Where a config handed to a tool comes from. */
export enum ConfigSource {
  Preset = 'preset',
  Shared = 'shared',
  Config = 'config',
  OnChain = 'on-chain',
}

/** The lab page share links open; set it to the live site's URL. */
export const LAB_URL_ENV = 'DBC_LAB_URL'
export const DEFAULT_LAB_URL = 'http://localhost:5180/'

export const MAX_COMPARED_CONFIGS = 8
export const DEFAULT_LAUNCHPADS_RETURNED = 10
export const MAX_LAUNCHPADS_RETURNED = 50

/** Decimal places kept in tool output; simulated SOL figures are not meaningful beyond it. */
export const DECIMALS_KEPT = 4

/** Agent-facing wording; the server answers in English only. */
export const MCP_TEXT = {
  unnamedConfig: 'Unnamed config',
  typicalLaunchName: 'A typical launch',
  customIntent: 'Supplied as a config object.',
  unknownPreset: 'No built-in preset has that id.',
  goalOrWeights: 'Give exactly one of goal or weights.',
  noArbitrageurs:
    'This launch situation has no arbitrage traders to know an outside price; use stock-listing.',
  noFlatBaseline:
    'The search found no flat-fee baseline for this base config, so it cannot rank proposals.',
  singleSeedCaveat:
    'One seeded launch: trader timing and sizes are random. Rerun with other seeds before drawing conclusions.',
  searchSeedsCaveat:
    'Each proposal is averaged over the search seeds listed; every figure is simulated, none is generated.',
  signingNote:
    'This server never signs or sends transactions. Open the share link in the lab to deploy from your own wallet, or run the TypeScript yourself.',
} as const
