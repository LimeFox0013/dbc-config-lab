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
  UnsupportedQuoteToken = 'unsupported-quote-token',
  NetworkError = 'network-error',
}

export { MAX_ADDRESS_LENGTH } from '../../core/shared'
