import {
  Body,
  Controller,
  Post,
  Query,
  Request,
  Response,
} from '@nestjs/common'

import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'

import { createMockedContextResponse } from '../serverless/mock-response.util'
import { ServerlessService } from '../serverless/serverless.service'
import { SnippetModel, SnippetType } from '../snippet/snippet.model'

@ApiName
@Controller('debug')
export class DebugController {
  constructor(
    private readonly serverlessService: ServerlessService,
    private readonly eventManager: EventManagerService,
  ) {}

  @Post('/ide')
  @HTTPDecorators.Idempotence()
  async ide() {
    await sleep(11111)
    return { a: 1 }
  }

  @Post('/events')
  async sendEvent(
    @Query('type') type: 'web' | 'admin' | 'all',
    @Query('event') event: BusinessEvents,
    @Body() payload: any,
  ) {
    switch (type) {
      case 'web':
        this.eventManager.broadcast(event, payload, {
          scope: EventScope.TO_SYSTEM_VISITOR,
        })
        break
      case 'admin':
        this.eventManager.broadcast(event, payload, {
          scope: EventScope.TO_SYSTEM_ADMIN,
        })
        break
      case 'all':
        this.eventManager.broadcast(event, payload, { scope: EventScope.ALL })

        break
    }
  }

  @Post('/function')
  @HTTPDecorators.Bypass
  async runFunction(
    @Body('function') functionString: string,
    @Request() req,
    @Response() res,
  ) {
    const model = new SnippetModel()
    model.name = 'debug'
    model.raw = functionString
    model.private = false
    model.type = SnippetType.Function

    const result =
      await this.serverlessService.injectContextIntoServerlessFunctionAndCall(
        model,
        { req, res: createMockedContextResponse(res) },
      )

    if (!res.sent) {
      res.send(result)
    }
  }
}
