import { FastifyReply, FastifyRequest } from 'fastify'

import {
  All,
  CacheTTL,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Request,
  Response,
} from '@nestjs/common'

import { ApiController } from '~/common/decorator/api-controller.decorator'
import { Auth } from '~/common/decorator/auth.decorator'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { IsMaster } from '~/common/decorator/role.decorator'
import { AssetService } from '~/processors/helper/helper.asset.service'

import { SnippetType } from '../snippet/snippet.model'
import { createMockedContextResponse } from './mock-response.util'
import { ServerlessReferenceDto } from './serverless.dto'
import { ServerlessService } from './serverless.service'

@ApiName
@ApiController(['serverless', 'fn'])
export class ServerlessController {
  constructor(
    private readonly serverlessService: ServerlessService,
    private readonly assetService: AssetService,
  ) {}

  @Get('/types')
  @Auth()
  @HTTPDecorators.Bypass
  @CacheTTL(60 * 60 * 24)
  async getCodeDefined() {
    try {
      const text = await this.assetService.getAsset('/types/type.declare.ts', {
        encoding: 'utf-8',
      })

      return text
    } catch (e) {
      throw new InternalServerErrorException('code defined file not found')
    }
  }
  @Get('/:reference/:name/*')
  @HTTPDecorators.Bypass
  async runServerlessFunctionWildcard(
    @Param() param: ServerlessReferenceDto,
    @IsMaster() isMaster: boolean,

    @Request() req: FastifyRequest,
    @Response() reply: FastifyReply,
  ) {
    return this.runServerlessFunction(param, isMaster, req, reply)
  }

  @All('/:reference/:name')
  @HTTPDecorators.Bypass
  async runServerlessFunction(
    @Param() param: ServerlessReferenceDto,
    @IsMaster() isMaster: boolean,

    @Request() req: FastifyRequest,
    @Response() reply: FastifyReply,
  ) {
    const requestMethod = req.method.toUpperCase()
    const { name, reference } = param
    const snippet = await this.serverlessService.model
      .findOne({
        name,
        reference,
        type: SnippetType.Function,
        method: requestMethod,
      })
      .select('+secret')
      .lean({
        getters: true,
      })

    const notExistMessage = 'serverless function is not exist or not enabled'

    if (!snippet) {
      throw new NotFoundException(notExistMessage)
    }

    if (snippet.method !== requestMethod || !snippet.enable) {
      throw new NotFoundException(notExistMessage)
    }

    if (snippet.private && !isMaster) {
      throw new ForbiddenException('no permission to run this function')
    }

    const result =
      await this.serverlessService.injectContextIntoServerlessFunctionAndCall(
        snippet,
        { req, res: createMockedContextResponse(reply) },
      )

    if (!reply.sent) {
      return reply.send(result)
    }
  }
}
