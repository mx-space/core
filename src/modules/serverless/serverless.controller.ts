import { FastifyReply, FastifyRequest } from 'fastify'

import {
  CacheTTL,
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Request,
  Response,
} from '@nestjs/common'

import { Auth } from '~/common/decorator/auth.decorator'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { IsMaster } from '~/common/decorator/role.decorator'

import { SnippetType } from '../snippet/snippet.model'
import { createMockedContextResponse } from './mock-response.util'
import { ServerlessReferenceDto } from './serverless.dto'
import { ServerlessService } from './serverless.service'

@ApiName
@Controller('serverless')
export class ServerlessController {
  constructor(private readonly serverlessService: ServerlessService) {}

  @Get('/types')
  @Auth()
  @HTTPDecorators.Bypass
  @CacheTTL(60 * 60 * 24)
  async getCodeDefined() {
    try {
      const text = await fs.readFile(
        path.join(cwd, 'assets', 'types', 'type.declare.ts'),
        {
          encoding: 'utf-8',
        },
      )

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

  @Get('/:reference/:name')
  @HTTPDecorators.Bypass
  async runServerlessFunction(
    @Param() param: ServerlessReferenceDto,
    @IsMaster() isMaster: boolean,

    @Request() req: FastifyRequest,
    @Response() reply: FastifyReply,
  ) {
    const { name, reference } = param
    const snippet = await this.serverlessService.model.findOne({
      name,
      reference,
      type: SnippetType.Function,
    })

    if (!snippet) {
      throw new NotFoundException('serverless function is not exist')
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
      reply.send(result)
    }
  }
}
