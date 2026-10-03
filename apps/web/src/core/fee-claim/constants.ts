/** Who a pool's unclaimed trading fees belong to. */
export enum FeeRole {
  /** The config's fee claimer (the launchpad). */
  Partner = 'partner',
  /** Whoever created the pool. */
  Creator = 'creator',
}
