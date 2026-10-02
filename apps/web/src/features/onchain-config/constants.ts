/** Anchor account names as the SDK's coder knows them (camelCase). */
export enum DbcAccount {
  PoolConfig = 'poolConfig',
  VirtualPool = 'virtualPool',
}

export enum LoadRejection {
  NotAnAddress = 'not-an-address',
  NotFound = 'not-found',
  NotDbcAccount = 'not-dbc-account',
  NotAConfigOrPool = 'not-a-config-or-pool',
  NetworkError = 'network-error',
}

/** Longest input treated as a possible address; base58 public keys are 32–44 characters. */
export const MAX_ADDRESS_LENGTH = 64
