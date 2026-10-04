/** A risk the terms leave open to a buyer; also its copy key. */
export enum ReportRisk {
  LiquidityPullable = 'liquidity-pullable',
  MintAuthorityKept = 'mint-authority-kept',
  MetadataMutable = 'metadata-mutable',
  NoAutoGraduation = 'no-auto-graduation',
  RefusedToday = 'refused-today',
}

/** Who holds an authority over the launched token; also its copy key. */
export enum TokenHolder {
  Partner = 'partner',
  Creator = 'creator',
}

/** Bumped when the report's data shape changes. */
export const REPORT_VERSION = 1
