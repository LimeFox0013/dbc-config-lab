import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { accountOf, parseBody, SessionGuard } from '../accounts'
import type { AccountRequest } from '../accounts'
import { AddWebhookBody, WebhooksService } from '../webhooks'
import type {
  DeliveryView,
  EndpointView,
  RegisteredEndpoint,
} from '../webhooks'
import { LIST_LIMIT } from './constants'
import { AddWatchBody, PauseBody } from './schemas'
import type { WatchEventView, WatchView } from './types'
import { WatchesService } from './watches.service'

/** `watches` / `webhooks`: the signed-in account's own watches, events and delivery addresses. */
@Controller('account')
@UseGuards(SessionGuard)
export class WatchesController {
  constructor(
    private readonly watches: WatchesService,
    private readonly webhooks: WebhooksService,
  ) {}

  @Get('watches')
  list(@Req() req: AccountRequest): Promise<WatchView[]> {
    return this.watches.list(accountOf(req).id)
  }

  @Post('watches')
  add(@Req() req: AccountRequest, @Body() body: unknown): Promise<WatchView> {
    return this.watches.add(accountOf(req), parseBody(AddWatchBody, body))
  }

  @Patch('watches/:id')
  pause(
    @Req() req: AccountRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<WatchView> {
    return this.watches.setPaused(
      accountOf(req).id,
      id,
      parseBody(PauseBody, body).paused,
    )
  }

  @Delete('watches/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: AccountRequest, @Param('id') id: string): Promise<void> {
    return this.watches.remove(accountOf(req).id, id)
  }

  @Get('events')
  events(@Req() req: AccountRequest): Promise<WatchEventView[]> {
    return this.watches.events(accountOf(req).id, LIST_LIMIT)
  }

  @Get('webhooks')
  listWebhooks(@Req() req: AccountRequest): Promise<EndpointView[]> {
    return this.webhooks.list(accountOf(req).id)
  }

  /** The signing secret is in this response only. */
  @Post('webhooks')
  addWebhook(
    @Req() req: AccountRequest,
    @Body() body: unknown,
  ): Promise<RegisteredEndpoint> {
    return this.webhooks.register(
      accountOf(req).id,
      parseBody(AddWebhookBody, body).url,
    )
  }

  @Delete('webhooks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeWebhook(
    @Req() req: AccountRequest,
    @Param('id') id: string,
  ): Promise<void> {
    return this.webhooks.remove(accountOf(req).id, id)
  }

  @Post('webhooks/:id/test')
  testWebhook(
    @Req() req: AccountRequest,
    @Param('id') id: string,
  ): Promise<DeliveryView> {
    return this.webhooks.sendTest(accountOf(req).id, id)
  }

  @Get('deliveries')
  deliveries(@Req() req: AccountRequest): Promise<DeliveryView[]> {
    return this.webhooks.deliveries(accountOf(req).id, LIST_LIMIT)
  }
}
