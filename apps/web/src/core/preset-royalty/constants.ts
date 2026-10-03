/** An author's share of a launchpad's fees, in whole percent. */
export const ROYALTY_PERCENT_LIMITS = { min: 1, max: 50 } as const

/** Shares in the fee vault are whole percents of this total. */
export const ROYALTY_TOTAL_SHARES = 100

export enum RoyaltyRejection {
  AuthorInvalid = 'author-invalid',
  AuthorIsDeployer = 'author-is-deployer',
  ShareOutOfRange = 'share-out-of-range',
  /** The fee vault holds one token: fees must be taken in the quote token only. */
  FeesInLaunchedToken = 'fees-in-launched-token',
  /** Vault and config must be created in one transaction, and this one would not fit. */
  TooLarge = 'too-large',
}

/**
 * Fee-vault account layout (the SDK's own `getRecipientDfsVault` offsets): recipient entries
 * start here and take this many bytes each. A royalty vault puts the deployer in slot 0 and
 * the author in slot 1.
 */
export const VAULT_USERS_OFFSET = 248
export const VAULT_USER_SIZE = 80
export const ROYALTY_RECIPIENT_SLOTS = [0, 1] as const
