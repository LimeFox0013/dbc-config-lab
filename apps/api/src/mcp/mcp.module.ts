import { Module } from '@nestjs/common'
import { AccountsModule } from '../accounts'
import { UsageModule } from '../usage'
import { McpController } from './mcp.controller'

@Module({ imports: [UsageModule, AccountsModule], controllers: [McpController] })
export class McpModule {}
