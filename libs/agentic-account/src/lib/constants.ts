export const AGENTIC_ACCOUNT_KEY_PREFIX = 'agt_'
export const REQUIRE_PERMISSION_METADATA_KEY =
  'agentic-account:require-permission'
export const AGENTIC_ACCOUNT_REPOSITORY_TOKEN = 'AGENTIC_ACCOUNT_REPOSITORY'

/** Random bytes behind each minted key (hex-encoded after the prefix). */
export const KEY_ENTROPY_BYTES = 32

/** Leading characters of a raw key kept as its displayable, non-secret prefix. */
export const KEY_DISPLAY_PREFIX_LENGTH = 10
export const KEY_DISPLAY_PREFIX_SUFFIX = '...'

/** Only this hash of a raw key is ever persisted or looked up. */
export const KEY_HASH_ALGORITHM = 'sha256'

/** `Authorization` scheme an agentic account presents its key with. */
export const BEARER_SCHEME_PREFIX = 'Bearer '
