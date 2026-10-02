export enum DeployStep {
  Idle = 'idle',
  Preparing = 'preparing',
  Ready = 'ready',
  Signing = 'signing',
  Done = 'done',
  Failed = 'failed',
}

/** Wallet Standard requires icons to be data URIs; anything else is not rendered. */
export const WALLET_ICON_PREFIX = 'data:image/'
