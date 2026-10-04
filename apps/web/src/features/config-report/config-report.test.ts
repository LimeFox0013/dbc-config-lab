import BN from 'bn.js'
import {
  MigrationOption,
  TokenAuthorityOption,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { describe, expect, it } from 'vitest'
import { configTerms } from '../../core/config-deploy'
import {
  compileLaunchConfig,
  LaunchPresetId,
  LAUNCH_PRESETS,
} from '../../core/launch-config'
import { QuoteToken } from '../../core/quote-token'
import { SolanaNetwork } from '../../core/shared'
import type { OnChainConfig } from '../onchain-config'
import { RealLaunchesRejection } from '../real-launches'
import {
  configReport,
  reportFileName,
  reportFindings,
  ReportRisk,
  simulationOf,
  TokenHolder,
  typicalLaunchRow,
} from '.'

const presetParameters = (id: LaunchPresetId): ConfigParameters => {
  const preset = LAUNCH_PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`No preset ${id}`)
  const compiled = compileLaunchConfig(preset.config)
  if (!compiled.ok) throw new Error(compiled.reason)
  return compiled.parameters
}

const findingsOf = (parameters: ConfigParameters) =>
  reportFindings(parameters, configTerms(parameters, QuoteToken.Sol))

const onChain = (parameters: ConfigParameters): OnChainConfig => ({
  configAddress: 'Config1111111111111111111111111111111111111',
  network: SolanaNetwork.Mainnet,
  feeClaimer: 'Claimer111111111111111111111111111111111111',
  parameters,
  quoteToken: QuoteToken.Sol,
})

describe('report findings', () => {
  const sniperShield = presetParameters(LaunchPresetId.SniperShield)

  it('finds nothing open on a built-in preset: liquidity locked, token immutable, keepers migrate', () => {
    expect(findingsOf(sniperShield)).toEqual([])
  })

  it('names the withdrawable share of graduation liquidity and who holds it', () => {
    const findings = findingsOf({
      ...sniperShield,
      partnerPermanentLockedLiquidityPercentage: 10,
      partnerLiquidityPercentage: 5,
      creatorPermanentLockedLiquidityPercentage: 0,
      creatorLiquidityPercentage: 85,
    })
    expect(findings).toContainEqual({
      risk: ReportRisk.LiquidityPullable,
      partnerPercent: 5,
      creatorPercent: 85,
    })
  })

  it.each([
    [
      TokenAuthorityOption.CreatorUpdateAndMintAuthority,
      ReportRisk.MintAuthorityKept,
      TokenHolder.Creator,
    ],
    [
      TokenAuthorityOption.PartnerUpdateAndMintAuthority,
      ReportRisk.MintAuthorityKept,
      TokenHolder.Partner,
    ],
    [
      TokenAuthorityOption.CreatorUpdateAuthority,
      ReportRisk.MetadataMutable,
      TokenHolder.Creator,
    ],
    [
      TokenAuthorityOption.PartnerUpdateAuthority,
      ReportRisk.MetadataMutable,
      TokenHolder.Partner,
    ],
  ])(
    'reports token authority option %i as %s held by the %s',
    (option, risk, holder) => {
      const [first] = findingsOf({
        ...sniperShield,
        tokenUpdateAuthority: option,
      })
      expect(first).toEqual({ risk, holder })
    },
  )

  it('flags a threshold below the migration keepers’ minimum', () => {
    const findings = findingsOf({
      ...sniperShield,
      migrationQuoteThreshold: new BN(1_000_000_000),
    })
    expect(findings.map((f) => f.risk)).toContain(ReportRisk.NoAutoGraduation)
  })

  it('reports retired terms with the SDK’s own reason', () => {
    const [finding] = findingsOf({
      ...sniperShield,
      migrationOption: MigrationOption.MET_DAMM,
    }).filter((f) => f.risk === ReportRisk.RefusedToday)
    expect(finding).toMatchObject({ risk: ReportRisk.RefusedToday })
    expect(finding && 'reason' in finding && finding.reason).toMatch(
      /deprecated/i,
    )
  })

  it('reports too little locked liquidity as refused today', () => {
    const findings = findingsOf({
      ...sniperShield,
      partnerPermanentLockedLiquidityPercentage: 0,
      partnerLiquidityPercentage: 50,
      creatorPermanentLockedLiquidityPercentage: 0,
      creatorLiquidityPercentage: 50,
    })
    expect(findings.map((f) => f.risk)).toEqual([
      ReportRisk.LiquidityPullable,
      ReportRisk.RefusedToday,
    ])
  })
})

describe('config report', () => {
  const config = onChain(presetParameters(LaunchPresetId.Flat))
  const row = typicalLaunchRow(config, 'A typical launch')

  it('keeps read and simulated figures apart, and marks branding unverified', () => {
    const report = configReport(config, {
      branding: { name: 'Pad\u0007', website: 'javascript:alert(1)', logo: '' },
      royalty: null,
      real: { ok: false, rejection: RealLaunchesRejection.NoPools },
      simulated: simulationOf(row),
    })
    expect(report.branding).toEqual({
      name: 'Pad',
      website: null,
      verified: false,
    })
    expect(report.real).toEqual({
      read: false,
      rejection: RealLaunchesRejection.NoPools,
      detail: undefined,
    })
    expect(report.simulated).toMatchObject({ situation: 'typical', seed: 42 })
    expect('metrics' in report.simulated).toBe(true)
  })

  it('has no real-launch figures until they are read', () => {
    const report = configReport(config, {
      branding: null,
      royalty: null,
      real: null,
      simulated: simulationOf(row),
    })
    expect(report.real).toBeNull()
  })

  it('survives a JSON round trip unchanged', () => {
    const report = configReport(config, {
      branding: null,
      royalty: null,
      real: null,
      simulated: simulationOf(row),
    })
    expect(JSON.parse(JSON.stringify(report))).toEqual(report)
    expect(reportFileName(report)).toBe(
      `dbc-config-report-mainnet-beta-${config.configAddress}.json`,
    )
  })
})
