import { CacheTTL } from '@nestjs/cache-manager'
import {
  All,
  Delete,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Query,
  Request,
  Response,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { IsAuthenticated } from '~/common/decorators/role.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { AssetService } from '~/processors/helper/helper.asset.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { SnippetType } from '../snippet/snippet.model'
import { createMockedContextResponse } from './mock-response.util'
import {
  ServerlessLogQueryDto,
  ServerlessReferenceDto,
} from './serverless.schema'
import { ServerlessService } from './serverless.service'

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
    } catch {
      throw new InternalServerErrorException('code defined file not found')
    }
  }
  @Get('/logs/:id')
  @Auth()
  async getInvocationLogs(
    @Param() param: MongoIdDto,
    @Query() query: ServerlessLogQueryDto,
  ) {
    const { id } = param
    const { page, size, status } = query
    return this.serverlessService.getInvocationLogs(id, {
      page,
      size,
      status,
    })
  }

  @Get('/compiled/:id')
  @Auth()
  @HTTPDecorators.Bypass
  async getCompiledCode(@Param() param: MongoIdDto) {
    const snippet = await this.serverlessService.model
      .findById(param.id)
      .select('+compiledCode')
      .lean()
    if (!snippet) {
      throw new NotFoundException('Snippet not found')
    }
    return snippet.compiledCode ?? null
  }

  @Get('/log/:id')
  @Auth()
  async getInvocationLogDetail(@Param('id') id: string) {
    const log = await this.serverlessService.getInvocationLogDetail(id)
    if (!log) {
      throw new NotFoundException('Invocation log not found')
    }
    return log
  }

  @All('/:reference/:name/*')
  @Throttle({
    default: {
      limit: 1000,
      ttl: 5000,
    },
  })
  @HTTPDecorators.Bypass
  async runServerlessFunctionWildcard(
    @Param() param: ServerlessReferenceDto,
    @IsAuthenticated() isAuthenticated: boolean,

    @Request() req: FastifyRequest,
    @Response() reply: FastifyReply,
  ) {
    return this.runServerlessFunction(param, isAuthenticated, req, reply)
  }

  @All('/:reference/:name')
  @Throttle({
    default: {
      limit: 100,
      ttl: 5000,
    },
  })
  @HTTPDecorators.Bypass
  async runServerlessFunction(
    @Param() param: ServerlessReferenceDto,
    @IsAuthenticated() isAuthenticated: boolean,

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
        $or: [
          {
            method: 'ALL',
          },
          {
            method: requestMethod,
          },
        ],
      })
      .select('+secret +compiledCode')
      .lean({
        getters: true,
      })

    const errorPath = `Path: /${reference}/${name}`
    if (!snippet) {
      throw new BizException(
        ErrorCodeEnum.FunctionNotFound,
        `serverless function is not exist, ${errorPath}`,
      )
    }

    if (!snippet.enable) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        `serverless function is not enabled, ${errorPath}`,
      )
    }

    if (snippet.private && !isAuthenticated) {
      throw new BizException(ErrorCodeEnum.ServerlessNoPermission)
    }

    const result =
      await this.serverlessService.injectContextIntoServerlessFunctionAndCall(
        snippet,
        { req, res: createMockedContextResponse(reply), isAuthenticated },
      )

    if (!reply.sent) {
      return reply.send(result)
    }
  }

  /**
   * 重置内建函数，过期的内建函数会被删除
   */
  @Delete('/reset/:id')
  @Auth()
  async resetBuiltInFunction(@Param('id') id: string) {
    const builtIn = await this.serverlessService.isBuiltInFunction(id)
    if (!builtIn) {
      const snippet = await this.serverlessService.model.findById(id)
      if (!snippet) {
        throw new BizException(ErrorCodeEnum.FunctionNotFound)
      }
      await this.serverlessService.model.deleteOne({ _id: id })
      return
    }
    await this.serverlessService.resetBuiltInFunction(builtIn)
  }
}
