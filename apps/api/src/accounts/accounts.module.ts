import { Module } from '@nestjs/common'
import { AgenticAccountService } from '@lf/agentic-account'
import { createDrizzleAgenticAccountRepository } from '@lf/agentic-account-drizzle'
import { agenticAccounts, agenticRoles, DRIZZLE_DB } from '../db'
import type { DrizzleDb } from '../db'
import { UsageModule } from '../usage'
import { AccountController, AuthController } from './account.controller'
import { AccountsService } from './accounts.service'
import { AuthService } from './auth.service'
import { KeysService } from './keys.service'
import { PaymentsService } from './payments.service'
import { SessionGuard } from './session.guard'

@Module({
  imports: [UsageModule],
  controllers: [AuthController, AccountController],
  providers: [
    AccountsService,
    AuthService,
    KeysService,
    PaymentsService,
    SessionGuard,
    {
      provide: AgenticAccountService,
      useFactory: (db: DrizzleDb): AgenticAccountService =>
        new AgenticAccountService(
          createDrizzleAgenticAccountRepository(db, { agenticRoles, agenticAccounts }),
        ),
      inject: [DRIZZLE_DB],
    },
  ],
  exports: [AccountsService, AuthService, KeysService, PaymentsService, SessionGuard],
})
export class AccountsModule {}
