import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  CollectFeeMode,
  MigratedCollectFeeMode,
  MigrationFeeOption,
  TokenAuthorityOption,
  TokenType,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { ConfigTerms } from '../core/config-deploy'
import { Connection } from '@solana/web3.js'
import { COMMITMENT, connectionFor } from '../core/config-deploy'
import type { SolanaNetwork } from '../core/shared'
import {
  compileLaunchConfig,
  LAUNCH_PRESETS,
  UserPresetId,
} from '../core/launch-config'
import { pullableLiquidityPercent } from '../core/migrated-pool'
import type { ComparisonEntry, ComparisonRow } from '../features/comparison'
import { EntryIdPrefix, parametersEntry } from '../features/comparison'
import {
  decodeSharedConfig,
  readSharedConfig,
  sharedFromHash,
} from '../features/config-sharing'
import type { DecodeResult, SharedConfig } from '../features/config-sharing'
import { loadOnChainConfig } from '../features/onchain-config'
import type { OnChainConfig } from '../features/onchain-config'
import en from '../locales/en.json'
import {
  ConfigSource,
  DECIMALS_KEPT,
  DEFAULT_LAB_URL,
  LAB_URL_ENV,
  MCP_TEXT,
  RPC_URL_ENV,
} from './constants'
import type { AnyConfigRef, DesignConfigRef } from './schemas'

type Refused = { ok: false; reason: string }

/** Every tool is read-only: nothing is signed, sent or stored. */
export const READ_ONLY = { readOnlyHint: true, destructiveHint: false } as const

const isHttpUrl = (value: string): boolean => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

/**
 * The network's connection: the endpoint its environment variable names, or the public
 * one. A provider URL usually carries its key, so it is never echoed back to the agent.
 */
export const rpcConnection = (network: SolanaNetwork): Connection => {
  const name = RPC_URL_ENV[network]
  const custom = process.env[name]
  if (!custom) return connectionFor(network)
  if (!isHttpUrl(custom)) throw new Error(`${name} ${MCP_TEXT.invalidRpcUrl}`)
  return new Connection(custom, { commitment: COMMITMENT })
}

/** The lab site links point at; set it to the live site's URL. */
export const labUrl = (): string => process.env[LAB_URL_ENV] ?? DEFAULT_LAB_URL

export type ResolvedDesign =
  | {
      ok: true
      label: Pick<ComparisonEntry, 'id' | 'name' | 'intent'>
      shared: SharedConfig
    }
  | Refused

export type ResolvedEntry = { ok: true; entry: ComparisonEntry } | Refused

export const reasonOf = (refusal: {
  rejection: string
  detail?: string
}): string =>
  refusal.detail ? `${refusal.rejection}: ${refusal.detail}` : refusal.rejection

/** The encoded config in a share link, or the input itself when it is not a link. */
const encodedFromLink = (link: string): string => {
  try {
    return sharedFromHash(new URL(link).hash) ?? link
  } catch {
    return link
  }
}

const fromDecoded = (
  result: DecodeResult,
  label: Pick<ComparisonEntry, 'id' | 'intent'>,
): ResolvedDesign =>
  result.ok
    ? {
        ok: true,
        label: { ...label, name: result.shared.name ?? MCP_TEXT.unnamedConfig },
        shared: result.shared,
      }
    : { ok: false, reason: reasonOf(result) }

/** A config the lab can design with, validated the way a shared link is. */
export const resolveDesign = (ref: DesignConfigRef): ResolvedDesign => {
  switch (ref.source) {
    case ConfigSource.Preset: {
      const preset = LAUNCH_PRESETS.find((candidate) => candidate.id === ref.id)
      return preset
        ? {
            ok: true,
            label: { id: preset.id, name: preset.name, intent: preset.intent },
            shared: {
              config: preset.config,
              name: preset.name,
              ...(preset.royalty ? { royalty: preset.royalty } : {}),
            },
          }
        : { ok: false, reason: MCP_TEXT.unknownPreset }
    }
    case ConfigSource.Shared:
      return fromDecoded(decodeSharedConfig(encodedFromLink(ref.link)), {
        id: UserPresetId.Shared,
        intent: en.views.compare.sharedIntent,
      })
    case ConfigSource.Config:
      return fromDecoded(
        readSharedConfig({ config: ref.config, name: ref.name }, 'input'),
        { id: UserPresetId.Custom, intent: MCP_TEXT.customIntent },
      )
  }
}

const onChainEntry = (loaded: OnChainConfig): ComparisonEntry =>
  parametersEntry(
    {
      id: `${EntryIdPrefix.OnChain}:${loaded.network}:${loaded.configAddress}`,
      name: loaded.configAddress,
      intent: en.views.compare.onChainIntent,
    },
    loaded.parameters,
    loaded.quoteToken,
  )

/** Any config a tool can simulate, including one read from chain. */
export const resolveEntry = async (
  ref: AnyConfigRef,
): Promise<ResolvedEntry> => {
  if (ref.source !== ConfigSource.OnChain) {
    const design = resolveDesign(ref)
    return design.ok
      ? {
          ok: true,
          entry: {
            ...design.label,
            compiled: compileLaunchConfig(design.shared.config),
          },
        }
      : design
  }
  const result = await loadOnChainConfig(
    rpcConnection(ref.network),
    ref.network,
    ref.address,
  )
  return result.ok
    ? { ok: true, entry: onChainEntry(result.loaded) }
    : { ok: false, reason: reasonOf(result) }
}

/** One comparison row as an agent reads it: metrics, price summary and pullable liquidity. */
export const rowSummary = (row: ComparisonRow) => {
  const { id, name, intent, compiled } = row.entry
  if (!row.ok) return { id, name, intent, ok: false, reason: row.reason }
  const multiples = row.path.map((point) => point.multiple)
  return {
    id,
    name,
    intent,
    ok: true,
    metrics: row.metrics,
    price: {
      peakMultiple: Math.max(...multiples),
      finalMultiple: multiples.at(-1) ?? null,
    },
    pullableLiquidityPercent: compiled.ok
      ? pullableLiquidityPercent(compiled.parameters)
      : null,
  }
}

const scale = 10 ** DECIMALS_KEPT

/** Tool output as JSON text, numbers cut to the precision the simulation supports. */
export const toolResult = (value: unknown): CallToolResult => ({
  content: [
    {
      type: 'text',
      text: JSON.stringify(
        value,
        (_key, field: unknown) =>
          typeof field === 'number' && !Number.isInteger(field)
            ? Math.round(field * scale) / scale
            : field,
        2,
      ),
    },
  ],
})

export const toolRefusal = (reason: string): CallToolResult => ({
  isError: true,
  content: [{ type: 'text', text: reason }],
})

/** The config-terms fields that hold an SDK option number. */
type OptionField =
  | 'tokenAuthority'
  | 'feesCollectedIn'
  | 'migrationFeeOption'
  | 'graduatedFeesCollectedIn'
  | 'tokenType'

export type ReadableTerms<T extends ConfigTerms> = Omit<T, OptionField> &
  Record<OptionField, string | undefined>

/** Config terms as an agent reads them: each SDK option number replaced by the SDK's name for it. */
export const readableTerms = <T extends ConfigTerms>(
  terms: T,
): ReadableTerms<T> => ({
  ...terms,
  tokenAuthority: TokenAuthorityOption[terms.tokenAuthority],
  feesCollectedIn: CollectFeeMode[terms.feesCollectedIn],
  migrationFeeOption: MigrationFeeOption[terms.migrationFeeOption],
  graduatedFeesCollectedIn:
    MigratedCollectFeeMode[terms.graduatedFeesCollectedIn],
  tokenType: TokenType[terms.tokenType],
})
