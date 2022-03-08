import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { AdminEventsGateway } from '~/processors/gateway/admin/events.gateway'
import { EventTypes } from '~/processors/gateway/events.types'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { PagerDto } from '~/shared/dto/pager.dto'
import { SnippetModel, SnippetType } from '../snippet/snippet.model'
import { SnippetService } from '../snippet/snippet.service'

@Controller('debug')
export class DebugController {
  constructor(
    private readonly webEvent: WebEventsGateway,
    private readonly adminEvent: AdminEventsGateway,

    private readonly snippetService: SnippetService,
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

  @Post('/function')
  @HTTPDecorators.Bypass
  async runFunction(@Body('function') functionString: string) {
    const model = new SnippetModel()
    model.name = 'debug'
    model.raw = functionString
    model.private = false
    model.type = SnippetType.Function
    return await this.snippetService.injectContextIntoServerlessFunctionAndCall(
      model,
    )
  }
}
