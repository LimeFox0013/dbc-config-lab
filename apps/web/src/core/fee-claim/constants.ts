/** Who a pool's unclaimed trading fees belong to. */
export enum FeeRole {
  /** The config's fee claimer (the launchpad). */
  Partner = 'partner',
  /** Whoever created the pool. */
  Creator = 'creator',
  /** A recipient of a royalty vault, moving a pool's launchpad fees into that vault. */
  VaultCollect = 'vault-collect',
  /** A recipient of a royalty vault, taking out their own share. */
  VaultShare = 'vault-share',
}

/** Why a claim is refused before it reaches a program. */
export const CLAIM_REASONS = {
  noVault: 'This royalty claim does not name its vault',
} as const
