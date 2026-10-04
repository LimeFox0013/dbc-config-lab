import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { LaunchPresetId } from '../core/launch-config'
import { ScenarioPresetId } from '../core/sniper-scenario'
import { decodeSharedConfig, sharedFromHash } from '../features/config-sharing'
import { LaunchGoal } from '../features/recommendation'
import { ConfigSource, DEFAULT_LAB_URL } from './constants'
import { createLabServer, ToolName } from '.'

const client = new Client({ name: 'mcp-test', version: '0.0.0' })

beforeAll(async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await createLabServer().connect(serverSide)
  await client.connect(clientSide)
})

const call = async (name: ToolName, args: Record<string, unknown>) => {
  const result = CallToolResultSchema.parse(
    await client.callTool({ name, arguments: args }),
  )
  const text = result.content.find((part) => part.type === 'text')
  return {
    isError: result.isError === true,
    text: text?.type === 'text' ? text.text : '',
  }
}

/** Calls a tool that must succeed and reads its JSON output as `schema`. */
const callFor = async <T>(
  schema: z.ZodType<T>,
  name: ToolName,
  args: Record<string, unknown>,
): Promise<T> => {
  const { isError, text } = await call(name, args)
  expect(isError, text).toBe(false)
  return schema.parse(JSON.parse(text))
}

const preset = (id: LaunchPresetId) => ({ source: ConfigSource.Preset, id })

const rowsSchema = z.object({
  rows: z.array(
    z.object({
      id: z.string(),
      ok: z.boolean(),
      metrics: z
        .object({ sniperProfit: z.number(), humanProfit: z.number() })
        .optional(),
      price: z.object({ peakMultiple: z.number() }).optional(),
      pullableLiquidityPercent: z.number().nullable().optional(),
    }),
  ),
})

const recommendationSchema = z.object({
  seeds: z.array(z.number()),
  proposals: z.array(
    z.object({ rank: z.number(), score: z.number(), shared: z.string() }),
  ),
})

const exportSchema = z.object({
  config: z.record(z.unknown()),
  shareLink: z.string(),
  typescript: z.string(),
})

describe('lab MCP server', () => {
  it('offers every tool, all read-only', async () => {
    const { tools } = await client.listTools()
    expect(tools.map((tool) => tool.name).sort()).toEqual(
      Object.values(ToolName).sort(),
    )
    expect(tools.every((tool) => tool.annotations?.readOnlyHint)).toBe(true)
  })

  it('lists presets, named situations and goals', async () => {
    const options = await callFor(
      z.object({
        presets: z.array(z.object({ id: z.string() })),
        situations: z.array(z.object({ id: z.string(), name: z.string() })),
        goals: z.array(z.object({ id: z.string(), name: z.string() })),
      }),
      ToolName.ListOptions,
      {},
    )
    expect(options.presets.map((p) => p.id)).toContain(
      LaunchPresetId.SniperShield,
    )
    expect(options.situations.map((s) => s.id)).toEqual(
      Object.values(ScenarioPresetId),
    )
    expect(options.goals.map((g) => g.id)).toEqual(Object.values(LaunchGoal))
  })

  it('compares presets the way the lab does: the shield turns sniping into a loss', async () => {
    const { rows } = await callFor(rowsSchema, ToolName.CompareConfigs, {
      configs: [
        preset(LaunchPresetId.Flat),
        preset(LaunchPresetId.SniperShield),
      ],
    })
    const [flat, shield] = rows
    expect(flat?.metrics?.sniperProfit).toBeGreaterThan(0)
    expect(shield?.metrics?.sniperProfit).toBeLessThan(0)
    expect(flat?.price?.peakMultiple).toBeGreaterThanOrEqual(1)
    expect(flat?.pullableLiquidityPercent).toBe(0)
  })

  it('refuses an undecodable shared config, naming which one', async () => {
    const { isError, text } = await call(ToolName.CompareConfigs, {
      configs: [
        preset(LaunchPresetId.Flat),
        { source: ConfigSource.Shared, link: '%%%' },
      ],
    })
    expect(isError).toBe(true)
    expect(text).toMatch(/^configs\[1\]: /)
  })

  it('recommends configs whose share strings compare like any other config', async () => {
    const recommendation = await callFor(
      recommendationSchema,
      ToolName.RecommendConfig,
      {
        goal: LaunchGoal.SniperDeterrent,
      },
    )
    expect(recommendation.seeds.length).toBeGreaterThan(1)
    expect(recommendation.proposals.map((p) => p.rank)).toEqual([1, 2, 3])
    const { rows } = await callFor(rowsSchema, ToolName.CompareConfigs, {
      configs: recommendation.proposals.map((p) => ({
        source: ConfigSource.Shared,
        link: p.shared,
      })),
    })
    expect(rows.every((row) => row.ok)).toBe(true)
  })

  it('accepts custom criterion weights, but not together with a goal', async () => {
    const weighted = await call(ToolName.RecommendConfig, {
      weights: { 'fee-income': 1 },
    })
    expect(weighted.isError).toBe(false)
    const both = await call(ToolName.RecommendConfig, {
      goal: LaunchGoal.FeeIncome,
      weights: { 'fee-income': 1 },
    })
    expect(both.isError).toBe(true)
  })

  it('anchors curves to an outside price the agent states', async () => {
    const outside = 600
    const recommendation = await callFor(
      z.object({
        outsideMarketCapSol: z.number(),
        proposals: z.array(
          z.object({
            curve: z
              .object({
                initialMarketCap: z.number(),
                migrationMarketCap: z.number(),
              })
              .nullable(),
          }),
        ),
      }),
      ToolName.RecommendConfig,
      {
        goal: LaunchGoal.FairPrice,
        situation: ScenarioPresetId.StockListing,
        outsideMarketCapSol: outside,
        includeCurves: true,
      },
    )
    expect(recommendation.outsideMarketCapSol).toBe(outside)
    const [best] = recommendation.proposals
    expect(best?.curve?.initialMarketCap).toBeGreaterThan(outside / 2)
    expect(best?.curve?.migrationMarketCap).toBeLessThanOrEqual(outside * 1.05)
  })

  it('refuses an outside price for a situation without arbitrage traders', async () => {
    const { isError } = await call(ToolName.CompareConfigs, {
      configs: [preset(LaunchPresetId.Flat)],
      situation: ScenarioPresetId.Typical,
      outsideMarketCapSol: 300,
    })
    expect(isError).toBe(true)
  })

  it('exports SDK code and a share link that reopens the same config', async () => {
    const exported = await callFor(exportSchema, ToolName.ExportConfig, {
      config: preset(LaunchPresetId.SoftOpen),
    })
    expect(exported.typescript).toContain('DynamicBondingCurveClient')
    expect(exported.shareLink.startsWith(DEFAULT_LAB_URL)).toBe(true)
    const encoded = sharedFromHash(new URL(exported.shareLink).hash) ?? ''
    const decoded = decodeSharedConfig(encoded)
    expect(decoded.ok && decoded.shared.config).toEqual(exported.config)
  })

  it('takes an edited config object back, validated by the program’s rules', async () => {
    const { config } = await callFor(exportSchema, ToolName.ExportConfig, {
      config: preset(LaunchPresetId.Flat),
    })
    const accepted = await call(ToolName.CompareConfigs, {
      configs: [{ source: ConfigSource.Config, config, name: 'Edited' }],
    })
    expect(accepted.isError).toBe(false)
    const refused = await call(ToolName.CompareConfigs, {
      configs: [
        {
          source: ConfigSource.Config,
          config: { ...config, curveShape: 'zigzag' },
        },
      ],
    })
    expect(refused.isError).toBe(true)
    expect(refused.text).toContain('invalid-field')
  })

  it('finds real launchpads sorted by partner income', async () => {
    const found = await callFor(
      z.object({
        matched: z.number(),
        launchpads: z.array(
          z.object({
            partnerIncomePerLaunch: z.object({ median: z.number() }),
          }),
        ),
      }),
      ToolName.FindLaunchpads,
      { limit: 3 },
    )
    expect(found.matched).toBeGreaterThan(3)
    const incomes = found.launchpads.map((l) => l.partnerIncomePerLaunch.median)
    expect(incomes).toEqual([...incomes].sort((a, b) => b - a))
  })
})
