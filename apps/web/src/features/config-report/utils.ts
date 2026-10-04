import { TokenAuthorityOption } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { currentRulesRefusal } from '../../core/config-clone'
import { configTerms } from '../../core/config-deploy'
import type { ConfigTerms } from '../../core/config-deploy'
import {
  displayBrandingName,
  safeBrandingUrl,
} from '../../core/partner-branding'
import type { PartnerBranding } from '../../core/partner-branding'
import type { RoyaltySplit } from '../../core/preset-royalty'
import { DEFAULT_SCENARIO, ScenarioPresetId } from '../../core/sniper-scenario'
import { compareRow, parametersEntry } from '../comparison'
import type { ComparisonRow } from '../comparison'
import type { OnChainConfig } from '../onchain-config'
import type { RealLaunchesResult } from '../real-launches'
import { REPORT_VERSION, ReportRisk, TokenHolder } from './constants'
import type {
  ConfigReport,
  ReportFinding,
  ReportRealLaunches,
  ReportSimulation,
} from './types'

/** What each token authority option leaves someone able to do after launch. */
const AUTHORITY_FINDINGS: Record<TokenAuthorityOption, ReportFinding | null> = {
  [TokenAuthorityOption.Immutable]: null,
  [TokenAuthorityOption.CreatorUpdateAuthority]: {
    risk: ReportRisk.MetadataMutable,
    holder: TokenHolder.Creator,
  },
  [TokenAuthorityOption.PartnerUpdateAuthority]: {
    risk: ReportRisk.MetadataMutable,
    holder: TokenHolder.Partner,
  },
  [TokenAuthorityOption.CreatorUpdateAndMintAuthority]: {
    risk: ReportRisk.MintAuthorityKept,
    holder: TokenHolder.Creator,
  },
  [TokenAuthorityOption.PartnerUpdateAndMintAuthority]: {
    risk: ReportRisk.MintAuthorityKept,
    holder: TokenHolder.Partner,
  },
}

/** The risks a config's terms leave open to a buyer, most consequential first. */
export const reportFindings = (
  parameters: ConfigParameters,
  terms: ConfigTerms,
): ReportFinding[] => {
  const { partnerPercentage, creatorPercentage } = terms.liquidity
  const refusal = currentRulesRefusal(parameters)
  const candidates: Array<ReportFinding | null> = [
    partnerPercentage + creatorPercentage > 0
      ? {
          risk: ReportRisk.LiquidityPullable,
          partnerPercent: partnerPercentage,
          creatorPercent: creatorPercentage,
        }
      : null,
    AUTHORITY_FINDINGS[terms.tokenAuthority],
    terms.keepersMigrate ? null : { risk: ReportRisk.NoAutoGraduation },
    refusal ? { risk: ReportRisk.RefusedToday, reason: refusal } : null,
  ]
  return candidates.filter(
    (finding): finding is ReportFinding => finding !== null,
  )
}

/** The lab's typical launch situation run against the config, labelled `name`. */
export const typicalLaunchRow = (
  config: OnChainConfig,
  name: string,
): ComparisonRow =>
  compareRow(
    parametersEntry(
      { id: config.configAddress, name, intent: '' },
      config.parameters,
      config.quoteToken,
    ),
    DEFAULT_SCENARIO,
  )

/** A typical-launch row as report data. */
export const simulationOf = (row: ComparisonRow): ReportSimulation => {
  const run = {
    situation: ScenarioPresetId.Typical,
    seed: DEFAULT_SCENARIO.seed,
  }
  return row.ok
    ? { ...run, metrics: row.metrics }
    : { ...run, unsupported: row.reason }
}

export const reportRealLaunches = (
  result: RealLaunchesResult | null,
): ReportRealLaunches =>
  result === null
    ? null
    : result.ok
      ? { read: true, launches: result.launches }
      : { read: false, rejection: result.rejection, detail: result.detail }

/** The report for a config read from chain; `real` is null until its launches are read. */
export const configReport = (
  config: OnChainConfig,
  extras: {
    branding: PartnerBranding | null
    royalty: RoyaltySplit | null
    real: RealLaunchesResult | null
    simulated: ReportSimulation
  },
): ConfigReport => {
  const terms = configTerms(config.parameters, config.quoteToken)
  return {
    version: REPORT_VERSION,
    configAddress: config.configAddress,
    poolAddress: config.poolAddress ?? null,
    network: config.network,
    feeClaimer: config.feeClaimer,
    branding: extras.branding
      ? {
          name: displayBrandingName(extras.branding.name),
          website: safeBrandingUrl(extras.branding.website),
          verified: false,
        }
      : null,
    royalty: extras.royalty,
    terms,
    risks: reportFindings(config.parameters, terms),
    real: reportRealLaunches(extras.real),
    simulated: extras.simulated,
  }
}

/** The file a downloaded report is saved as. */
export const reportFileName = (report: ConfigReport): string =>
  `dbc-config-report-${report.network}-${report.configAddress}.json`
