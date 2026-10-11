/** How often an open dashboard reads its figures again. */
export const OPERATOR_REFRESH_MS = 60_000

/** Graduated-pool positions read per quote token; an even sample beyond it, scaled up. */
export const POSITION_READ_LIMIT = 1000

/** Why a dashboard could not be read. */
export enum OperatorRejection {
  InvalidAddress = 'invalid-address',
  NoConfigs = 'no-configs',
  NetworkError = 'network-error',
}
