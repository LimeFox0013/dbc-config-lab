/** Callers identified by account (through an API key) carry this prefix before the account id. */
export const ACCOUNT_CALLER_PREFIX = 'acct:'

/** Callers identified by network address carry this prefix before the address's keyed hash. */
export const ADDRESS_CALLER_PREFIX = 'addr:'

/** Secret that keys the address hash, so a stored hash cannot be reversed by trying every address. */
export const CALLER_HASH_KEY_ENV = 'CALLER_HASH_KEY'
