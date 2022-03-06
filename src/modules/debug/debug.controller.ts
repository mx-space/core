import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { AdminEventsGateway } from '~/processors/gateway/admin/events.gateway'
import { EventTypes } from '~/processors/gateway/events.types'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { PagerDto } from '~/shared/dto/pager.dto'

@Controller('debug')
export class DebugController {
  constructor(
    private readonly webEvent: WebEventsGateway,
    private readonly adminEvent: AdminEventsGateway,
  ) {}
  @Get('qs')
  async qs(@Query() query: PagerDto) {
    return query
  }

  @Post('/events')
  async sendEvent(
    @Query('type') type: 'web' | 'admin' | 'all',
    @Query('event') event: EventTypes,
    @Body() payload: any,
  ) {
    switch (type) {
      case 'web':
        this.webEvent.broadcast(event, payload)
        break
      case 'admin':
        this.adminEvent.broadcast(event, payload)
        break
      case 'all':
        this.webEvent.broadcast(event, payload)
        this.adminEvent.broadcast(event, payload)
        break
    }
  }
}
