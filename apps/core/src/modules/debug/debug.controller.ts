import { Body, Get, Post, Query, Request, Response } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { RawResponse } from '~/common/response/raw-response.decorator'
import { ResponseV2 } from '~/common/response/v2-controller.decorator'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'

import { createMockedContextResponse } from '../serverless/mock-response.util'
import { ServerlessService } from '../serverless/serverless.service'
import { SnippetType } from '../snippet/snippet.schema'
import type { SnippetRow } from '../snippet/snippet.types'
import { DebugService } from './debug.service'

@ApiController('debug')
@ResponseV2()
export class DebugController {
  constructor(
    private readonly serverlessService: ServerlessService,
    private readonly eventManager: EventManagerService,

    private readonly debugService: DebugService,
  ) {}

  @Get('/test')
  test() {
    this.debugService.test()
    return ''
  }

  @Post('/events')
  async sendEvent(
    @Query('type') type: 'web' | 'admin' | 'all',
    @Query('event') event: BusinessEvents,
    @Body() payload: any,
  ) {
    Date.prototype.toJSON = function () {
      return this.toISOString()
    }
    payload.date = new Date()

    const scopeMap = {
      web: EventScope.TO_SYSTEM_VISITOR,
      admin: EventScope.TO_SYSTEM_ADMIN,
      all: EventScope.ALL,
    } as const

    this.eventManager.broadcast(event, payload, { scope: scopeMap[type] })
  }

  @Post('/function')
  @RawResponse
  async runFunction(
    @Body('function') functionString: string,
    @Request() req,
    @Response() res,
  ) {
    const model: SnippetRow = {
      id: '' as any,
      name: 'debug',
      raw: functionString,
      private: false,
      type: SnippetType.Function,
      reference: 'root',
      comment: null,
      metatype: null,
      schema: null,
      method: null,
      customPath: null,
      secret: null,
      enable: true,
      builtIn: false,
      compiledCode: null,
      createdAt: new Date(),
      updatedAt: null,
    }

    const result =
      await this.serverlessService.injectContextIntoServerlessFunctionAndCall(
        model,
        { req, res: createMockedContextResponse(res), hasAdminAccess: true },
      )

    if (!res.sent) {
      return res.send(result)
    }
  }
}
