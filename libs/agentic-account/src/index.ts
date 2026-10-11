// ── Module & Service ─────────────────────────────────────────────────────────
export { AgenticAccountModule } from './lib/agentic-account.module.js'
export { AgenticAccountService } from './lib/agentic-account.service.js'
export type {
  AgenticAccountModuleOptions,
  MintedAgenticAccount,
  AuthenticatedAgenticAccount,
  RequestWithAgenticAccount,
} from './lib/types.js'

// ── Guard & Decorator ────────────────────────────────────────────────────────
export { AgenticAccountGuard } from './lib/agentic-account.guard.js'
export { RequirePermission } from './lib/require-permission.decorator.js'

// ── Port Interfaces ──────────────────────────────────────────────────────────
export type {
  IAgenticAccountRepository,
  AgenticRoleRow,
  AgenticAccountRow,
  AgenticAccountWithPermissions,
} from './lib/agentic-account.ports.js'

// ── Constants ────────────────────────────────────────────────────────────────
export {
  AGENTIC_ACCOUNT_KEY_PREFIX,
  REQUIRE_PERMISSION_METADATA_KEY,
  AGENTIC_ACCOUNT_REPOSITORY_TOKEN,
} from './lib/constants.js'
