import { describe, expect, it } from 'vitest'
import { DEFAULT_LAUNCH_CONFIG } from '../../core/launch-config'
import { SolanaNetwork } from '../../core/shared'
import { HANDOFF_PAGE_PATH } from '../../router/constants'
import { encodeSharedConfig } from '../config-sharing'
import { decodeHandoff, HandoffAction, HandoffRejection, handoffPath } from '.'
import type { HandoffIntent, HandoffResult } from '.'

const OWNER = 'DrkDGXgnMJDWht6qcEVgur9JMEzf7kuWJKtZhvV2Kt5D'
const LAUNCHPAD = 'Z4EsKJjpBuxKqbRNzxeWbj7PsaNcp2vjZpAHWu86Wkn'
const base = { network: SolanaNetwork.Devnet, owner: OWNER }

const fragmentOf = (intent: HandoffIntent): string =>
  handoffPath(intent).slice(HANDOFF_PAGE_PATH.length)

const rejectionOf = (result: HandoffResult): HandoffRejection | null =>
  result.ok ? null : result.rejection

const INTENTS: HandoffIntent[] = [
  {
    ...base,
    action: HandoffAction.Deploy,
    shared: { config: DEFAULT_LAUNCH_CONFIG, name: 'Mine' },
  },
  {
    ...base,
    action: HandoffAction.Branding,
    branding: { name: 'Pad', website: 'https://pad.example', logo: '' },
  },
  {
    ...base,
    action: HandoffAction.Launch,
    configAddress: LAUNCHPAD,
    metadata: { name: 'Token', symbol: 'TKN', uri: '' },
    firstBuy: 0.05,
  },
  { ...base, network: SolanaNetwork.Mainnet, action: HandoffAction.Claim },
  {
    ...base,
    action: HandoffAction.Clone,
    sourceAddress: LAUNCHPAD,
    sourceNetwork: SolanaNetwork.Mainnet,
    adjustments: {
      creatorTradingFeePercentage: 20,
      liquidity: {
        partnerPercentage: 0,
        partnerLockedPercentage: 50,
        creatorPercentage: 0,
        creatorLockedPercentage: 50,
      },
    },
  },
  {
    ...base,
    action: HandoffAction.Clone,
    sourceAddress: LAUNCHPAD,
    sourceNetwork: SolanaNetwork.Devnet,
    adjustments: {},
  },
]

describe('hand-off links', () => {
  it.each(INTENTS)('round-trips a $action intent', (intent) => {
    expect(handoffPath(intent).startsWith(`${HANDOFF_PAGE_PATH}#`)).toBe(true)
    expect(decodeHandoff(fragmentOf(intent))).toEqual({ ok: true, intent })
  })

  it('refuses an empty, oversized or unknown fragment', () => {
    expect(rejectionOf(decodeHandoff(''))).toBe(HandoffRejection.Missing)
    expect(
      rejectionOf(decodeHandoff(`#action=claim&x=${'a'.repeat(20000)}`)),
    ).toBe(HandoffRejection.TooLong)
    expect(
      rejectionOf(decodeHandoff(`#action=swap&network=devnet&owner=${OWNER}`)),
    ).toBe(HandoffRejection.UnknownAction)
    expect(
      rejectionOf(
        decodeHandoff(`#action=claim&network=testnet&owner=${OWNER}`),
      ),
    ).toBe(HandoffRejection.UnknownNetwork)
    expect(
      rejectionOf(
        decodeHandoff('#action=claim&network=devnet&owner=not-a-key'),
      ),
    ).toBe(HandoffRejection.InvalidOwner)
  })

  it('refuses a deploy whose config the program would not accept', () => {
    const shared = encodeSharedConfig({
      config: {
        ...DEFAULT_LAUNCH_CONFIG,
        liquidityDistribution: {
          ...DEFAULT_LAUNCH_CONFIG.liquidityDistribution,
          partnerLiquidityPercentage: 10,
        },
      },
    })
    const result = decodeHandoff(
      `#action=deploy&network=devnet&owner=${OWNER}&shared=${shared}`,
    )
    expect(rejectionOf(result)).toBe(HandoffRejection.InvalidConfig)
  })

  it('refuses launch and branding fields the screens would refuse', () => {
    const launch = (fields: string): HandoffResult =>
      decodeHandoff(`#action=launch&network=devnet&owner=${OWNER}&${fields}`)
    expect(rejectionOf(launch(`launchpad=bad&name=T&symbol=T`))).toBe(
      HandoffRejection.InvalidLaunchpad,
    )
    expect(rejectionOf(launch(`launchpad=${LAUNCHPAD}&name=&symbol=T`))).toBe(
      HandoffRejection.InvalidMetadata,
    )
    expect(
      rejectionOf(
        launch(`launchpad=${LAUNCHPAD}&name=T&symbol=T&first-buy=-1`),
      ),
    ).toBe(HandoffRejection.InvalidFirstBuy)
    expect(
      rejectionOf(
        decodeHandoff(
          `#action=branding&network=devnet&owner=${OWNER}&name=Pad&website=http://pad.example`,
        ),
      ),
    ).toBe(HandoffRejection.InvalidBranding)
  })

  it('refuses a clone with no valid original or with adjustments it does not take', () => {
    const clone = (fields: string): HandoffResult =>
      decodeHandoff(`#action=clone&network=devnet&owner=${OWNER}&${fields}`)
    expect(rejectionOf(clone('source=bad&source-network=devnet'))).toBe(
      HandoffRejection.InvalidSource,
    )
    expect(
      rejectionOf(
        clone(`source=${LAUNCHPAD}&source-network=devnet&adjustments=not-json`),
      ),
    ).toBe(HandoffRejection.InvalidAdjustments)
    expect(
      rejectionOf(
        clone(
          `source=${LAUNCHPAD}&source-network=devnet&adjustments=${encodeURIComponent(
            '{"creatorTradingFeePercentage":"all"}',
          )}`,
        ),
      ),
    ).toBe(HandoffRejection.InvalidAdjustments)
    const extra = clone(
      `source=${LAUNCHPAD}&source-network=devnet&adjustments=${encodeURIComponent(
        '{"feeClaimer":"someone"}',
      )}`,
    )
    expect(extra).toMatchObject({ ok: true, intent: { adjustments: {} } })
  })
})
