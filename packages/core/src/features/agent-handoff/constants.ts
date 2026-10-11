import { MAX_SHARE_LENGTH } from '../config-sharing'

/** An on-chain action an agent can propose and a person can sign on the hand-off page. */
export enum HandoffAction {
  Deploy = 'deploy',
  /** Deploy a copy of a config already on chain, optionally adjusted. */
  Clone = 'clone',
  Branding = 'branding',
  Launch = 'launch',
  Claim = 'claim',
}

/** The fragment parameters a hand-off link carries. */
export enum HandoffParam {
  Action = 'action',
  Network = 'network',
  Owner = 'owner',
  /** A deploy's config, encoded as a share link encodes it. */
  Shared = 'shared',
  /** The config a token launches on. */
  Launchpad = 'launchpad',
  /** A clone's original: a config or pool address, and the network it is on. */
  Source = 'source',
  SourceNetwork = 'source-network',
  /** A clone's adjustments, as JSON. */
  Adjustments = 'adjustments',
  Name = 'name',
  Symbol = 'symbol',
  Uri = 'uri',
  FirstBuy = 'first-buy',
  Website = 'website',
  Logo = 'logo',
}

/** A share-encoded config plus the short fields of any action. */
export const MAX_HANDOFF_LENGTH = MAX_SHARE_LENGTH + 2048

export enum HandoffRejection {
  Missing = 'missing',
  TooLong = 'too-long',
  UnknownAction = 'unknown-action',
  UnknownNetwork = 'unknown-network',
  InvalidOwner = 'invalid-owner',
  InvalidConfig = 'invalid-config',
  InvalidLaunchpad = 'invalid-launchpad',
  InvalidMetadata = 'invalid-metadata',
  InvalidFirstBuy = 'invalid-first-buy',
  InvalidBranding = 'invalid-branding',
  InvalidSource = 'invalid-source',
  InvalidAdjustments = 'invalid-adjustments',
}

/** Where a proposed clone stands on the hand-off page while its original is read from chain. */
export enum CloneStatus {
  Loading = 'loading',
  Refused = 'refused',
  Ready = 'ready',
}
