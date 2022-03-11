import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Request,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { IsMaster } from '~/common/decorator/role.decorator'
import { createMockedContextResponse } from './mock-response.util'
import { ServerlessReferenceDto } from './serverless.dto'
import { ServerlessService } from './serverless.service'

@ApiName
@Controller('serverless')
export class ServerlessController {
  constructor(private readonly serverlessService: ServerlessService) {}

  @Get('/:reference/:name')
  @HTTPDecorators.Bypass
  async runServerlessFunction(
    @Param() param: ServerlessReferenceDto,
    @IsMaster() isMaster: boolean,

    @Request() req: FastifyRequest,
  ) {
    const { name, reference } = param
    const snippet = await this.serverlessService.model.findOne({
      name,
      reference,
    })

    if (!snippet) {
      throw new NotFoundException('snippet is not found')
    }

    if (snippet.private && !isMaster) {
      throw new ForbiddenException('no permission to run this function')
    }
    return this.serverlessService.injectContextIntoServerlessFunctionAndCall(
      snippet,
      { req, res: createMockedContextResponse() },
    )
  }
}
