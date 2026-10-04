import { clonedParameters } from '../../core/config-clone'
import type { CloneAdjustments } from '../../core/config-clone'
import { compileLaunchConfig, UserPresetId } from '../../core/launch-config'
import { brandingRejection } from '../../core/partner-branding'
import { metadataRejection } from '../../core/pool-launch'
import { isRecord, parseAddress, SolanaNetwork } from '../../core/shared'
import { HANDOFF_PAGE_PATH } from '../../router/constants'
import { decodeSharedConfig, encodeSharedConfig } from '../config-sharing'
import type { SharedConfig } from '../config-sharing'
import { EntryIdPrefix, parametersEntry } from '../comparison'
import type { DeployTarget } from '../deployment'
import type { OnChainConfig } from '../onchain-config'
import {
  HandoffAction,
  HandoffParam,
  HandoffRejection,
  MAX_HANDOFF_LENGTH,
} from './constants'
import type { HandoffCloneResult, HandoffIntent, HandoffResult } from './types'

const actionFields = (intent: HandoffIntent): [HandoffParam, string][] => {
  switch (intent.action) {
    case HandoffAction.Deploy:
      return [[HandoffParam.Shared, encodeSharedConfig(intent.shared)]]
    case HandoffAction.Clone:
      return [
        [HandoffParam.Source, intent.sourceAddress],
        [HandoffParam.SourceNetwork, intent.sourceNetwork],
        [HandoffParam.Adjustments, JSON.stringify(intent.adjustments)],
      ]
    case HandoffAction.Branding:
      return [
        [HandoffParam.Name, intent.branding.name],
        [HandoffParam.Website, intent.branding.website],
        [HandoffParam.Logo, intent.branding.logo],
      ]
    case HandoffAction.Launch:
      return [
        [HandoffParam.Launchpad, intent.configAddress],
        [HandoffParam.Name, intent.metadata.name],
        [HandoffParam.Symbol, intent.metadata.symbol],
        [HandoffParam.Uri, intent.metadata.uri],
        [HandoffParam.FirstBuy, String(intent.firstBuy)],
      ]
    case HandoffAction.Claim:
      return []
  }
}

/** The hand-off page's path for an intent; everything rides in the fragment, never sent to a server. */
export const handoffPath = (intent: HandoffIntent): string =>
  `${HANDOFF_PAGE_PATH}#${new URLSearchParams([
    [HandoffParam.Action, intent.action],
    [HandoffParam.Network, intent.network],
    [HandoffParam.Owner, intent.owner],
    ...actionFields(intent),
  ]).toString()}`

const isAction = (value: string | null): value is HandoffAction =>
  Object.values<string | null>(HandoffAction).includes(value)

const isNetwork = (value: string | null): value is SolanaNetwork =>
  Object.values<string | null>(SolanaNetwork).includes(value)

type Refused = Extract<HandoffResult, { ok: false }>

/** Thrown inside `readAdjustments` for any field that is not what a clone adjustment takes. */
class InvalidAdjustment extends Error {}

const numberAt = (fields: Record<string, unknown>, key: string): number => {
  const value = fields[key]
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new InvalidAdjustment(key)
  return value
}

const recordAt = (value: unknown, key: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new InvalidAdjustment(key)
  return value
}

/**
 * A clone's adjustments from untrusted JSON, rebuilt from the known fields only; whether
 * each value is one the program accepts is left to `clonedParameters`.
 */
const readAdjustments = (json: string): CloneAdjustments | null => {
  try {
    const fields = recordAt(JSON.parse(json || '{}'), 'adjustments')
    const { feeSchedule, liquidity, firstBuyAtMinimumFee } = fields
    if (
      firstBuyAtMinimumFee !== undefined &&
      typeof firstBuyAtMinimumFee !== 'boolean'
    )
      throw new InvalidAdjustment('firstBuyAtMinimumFee')
    const schedule =
      feeSchedule === undefined
        ? undefined
        : recordAt(feeSchedule, 'feeSchedule')
    const split =
      liquidity === undefined ? undefined : recordAt(liquidity, 'liquidity')
    return {
      ...(schedule && {
        feeSchedule: {
          startingFeeBps: numberAt(schedule, 'startingFeeBps'),
          endingFeeBps: numberAt(schedule, 'endingFeeBps'),
          windowSeconds: numberAt(schedule, 'windowSeconds'),
        },
      }),
      ...(fields['creatorTradingFeePercentage'] !== undefined && {
        creatorTradingFeePercentage: numberAt(
          fields,
          'creatorTradingFeePercentage',
        ),
      }),
      ...(split && {
        liquidity: {
          partnerPercentage: numberAt(split, 'partnerPercentage'),
          partnerLockedPercentage: numberAt(split, 'partnerLockedPercentage'),
          creatorPercentage: numberAt(split, 'creatorPercentage'),
          creatorLockedPercentage: numberAt(split, 'creatorLockedPercentage'),
        },
      }),
      ...(firstBuyAtMinimumFee !== undefined && { firstBuyAtMinimumFee }),
    }
  } catch {
    return null
  }
}

const refused = (rejection: HandoffRejection, detail?: string): Refused => ({
  ok: false,
  rejection,
  ...(detail === undefined ? {} : { detail }),
})

/**
 * Decodes an untrusted hand-off fragment: size cap → known action and network → a valid
 * owner address → the action's own fields, checked the way the lab's screens check them.
 */
export const decodeHandoff = (hash: string): HandoffResult => {
  const fragment = hash.replace(/^#/, '')
  if (fragment.length === 0) return refused(HandoffRejection.Missing)
  if (fragment.length > MAX_HANDOFF_LENGTH)
    return refused(HandoffRejection.TooLong)
  const params = new URLSearchParams(fragment)
  const field = (name: HandoffParam): string => params.get(name) ?? ''

  const action = params.get(HandoffParam.Action)
  if (!isAction(action)) return refused(HandoffRejection.UnknownAction)
  const network = params.get(HandoffParam.Network)
  if (!isNetwork(network)) return refused(HandoffRejection.UnknownNetwork)
  const owner = parseAddress(field(HandoffParam.Owner))
  if (!owner) return refused(HandoffRejection.InvalidOwner)
  const base = { network, owner: owner.toBase58() }

  switch (action) {
    case HandoffAction.Deploy: {
      const decoded = decodeSharedConfig(field(HandoffParam.Shared))
      return decoded.ok
        ? { ok: true, intent: { ...base, action, shared: decoded.shared } }
        : refused(
            HandoffRejection.InvalidConfig,
            decoded.detail ?? decoded.rejection,
          )
    }
    case HandoffAction.Clone: {
      const source = parseAddress(field(HandoffParam.Source))
      const sourceNetwork = params.get(HandoffParam.SourceNetwork)
      if (!source || !isNetwork(sourceNetwork))
        return refused(HandoffRejection.InvalidSource)
      const adjustments = readAdjustments(field(HandoffParam.Adjustments))
      if (!adjustments) return refused(HandoffRejection.InvalidAdjustments)
      return {
        ok: true,
        intent: {
          ...base,
          action,
          sourceAddress: source.toBase58(),
          sourceNetwork,
          adjustments,
        },
      }
    }
    case HandoffAction.Branding: {
      const branding = {
        name: field(HandoffParam.Name),
        website: field(HandoffParam.Website),
        logo: field(HandoffParam.Logo),
      }
      const rejection = brandingRejection(branding)
      return rejection
        ? refused(HandoffRejection.InvalidBranding, rejection)
        : { ok: true, intent: { ...base, action, branding } }
    }
    case HandoffAction.Launch: {
      const launchpad = parseAddress(field(HandoffParam.Launchpad))
      if (!launchpad) return refused(HandoffRejection.InvalidLaunchpad)
      const metadata = {
        name: field(HandoffParam.Name),
        symbol: field(HandoffParam.Symbol),
        uri: field(HandoffParam.Uri),
      }
      const rejection = metadataRejection(metadata)
      if (rejection) return refused(HandoffRejection.InvalidMetadata, rejection)
      const firstBuy = Number(field(HandoffParam.FirstBuy) || 0)
      if (!Number.isFinite(firstBuy) || firstBuy < 0)
        return refused(HandoffRejection.InvalidFirstBuy)
      return {
        ok: true,
        intent: {
          ...base,
          action,
          configAddress: launchpad.toBase58(),
          metadata,
          firstBuy,
        },
      }
    }
    case HandoffAction.Claim:
      return { ok: true, intent: { ...base, action } }
  }
}

/** A proposed deploy's config as the deploy step takes it; never one of the built-in presets. */
export const handoffDeployTarget = (
  shared: SharedConfig,
  label: Pick<DeployTarget, 'name' | 'intent'>,
): DeployTarget => ({
  id: UserPresetId.Shared,
  ...label,
  compiled: compileLaunchConfig(shared.config),
  royalty: shared.royalty ?? null,
})

/** A clone of `original` with the proposed adjustments, as the deploy step takes it. */
export const handoffCloneTarget = (
  original: OnChainConfig,
  adjustments: CloneAdjustments,
  label: Pick<DeployTarget, 'name' | 'intent'>,
): HandoffCloneResult => {
  const clone = clonedParameters(original.parameters, adjustments)
  if (!clone.ok) return clone
  return {
    ok: true,
    target: {
      ...parametersEntry(
        {
          id: `${EntryIdPrefix.Clone}:${original.network}:${original.configAddress}`,
          ...label,
        },
        clone.parameters,
        original.quoteToken,
      ),
      royalty: null,
    },
  }
}
