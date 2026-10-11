import { Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { AccountsModule } from './accounts'
import { DbModule } from './db'
import { SanitizingExceptionFilter } from './errors'
import { HealthController } from './health'
import { McpModule } from './mcp'
import { WatchesModule } from './watches'

@Module({
  imports: [DbModule, AccountsModule, McpModule, WatchesModule],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: SanitizingExceptionFilter }],
})
export class AppModule {}
