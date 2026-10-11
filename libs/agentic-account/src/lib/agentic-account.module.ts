import { DynamicModule, Module } from '@nestjs/common'
import { AgenticAccountService } from './agentic-account.service.js'
import { AgenticAccountGuard } from './agentic-account.guard.js'
import { AGENTIC_ACCOUNT_REPOSITORY_TOKEN } from './constants.js'
import type { AgenticAccountModuleOptions } from './types.js'
import { toProvider } from './utils.js'

/**
 * @module @lf/agentic-account
 *
 * Reusable per-tenant external-caller identity: mint a disclose-once bearer
 * credential scoped to one (external system, tenant) pair, authenticate it
 * on inbound requests, and gate routes by a growable, named role's
 * permissions. Generic over persistence — each project supplies its own
 * repository (see `@lf/agentic-account-drizzle` for the Drizzle-backed one).
 *
 * @example
 * ```ts
 * AgenticAccountModule.forRoot({
 *   repository: createDrizzleAgenticAccountRepository(db, { agenticAccounts, agenticRoles }),
 * })
 * ```
 */
@Module({})
export class AgenticAccountModule {
  static forRoot(options: AgenticAccountModuleOptions): DynamicModule {
    const repositoryProvider = toProvider(
      AGENTIC_ACCOUNT_REPOSITORY_TOKEN,
      options.repository,
    )

    return {
      module: AgenticAccountModule,
      providers: [
        repositoryProvider,
        AgenticAccountService,
        AgenticAccountGuard,
      ],
      exports: [AgenticAccountService, AgenticAccountGuard],
    }
  }
}
