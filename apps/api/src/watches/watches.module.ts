import { Module } from '@nestjs/common'
import { AccountsModule } from '../accounts'
import { WebhooksService } from '../webhooks'
import { ChainService } from './chain.service'
import { PollerService } from './poller.service'
import { WatchesController } from './watches.controller'
import { WatchesService } from './watches.service'

@Module({
  imports: [AccountsModule],
  controllers: [WatchesController],
  providers: [ChainService, PollerService, WatchesService, WebhooksService],
})
export class WatchesModule {}
