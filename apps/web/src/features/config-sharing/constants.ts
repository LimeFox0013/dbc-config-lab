import { CurveShape } from '../../core/launch-config'

/** URL fragment key; fragments are never sent to a server. */
export const SHARE_PARAM = 'config'
export const SHARE_VERSION = 1
/** Longest encoded config accepted, checked before any decoding. */
export const MAX_SHARE_LENGTH = 8192
export const NAME_MAX_LENGTH = 60

export enum ShareRejection {
  TooLong = 'too-long',
  NotDecodable = 'not-decodable',
  NotJson = 'not-json',
  WrongVersion = 'wrong-version',
  InvalidField = 'invalid-field',
  RejectedByProgram = 'rejected-by-program',
}

/** The SDK builder that creates each curve shape. */
export const BUILDER_BY_SHAPE: Record<CurveShape, string> = {
  [CurveShape.Standard]: 'buildCurve',
  [CurveShape.MarketCap]: 'buildCurveWithMarketCap',
  [CurveShape.TwoSegments]: 'buildCurveWithTwoSegments',
  [CurveShape.LiquidityWeights]: 'buildCurveWithLiquidityWeights',
}

/** Keys of a launch config that are not builder parameters. */
export const NON_BUILDER_KEYS: ReadonlySet<string> = new Set([
  'curveShape',
  'quoteToken',
])
