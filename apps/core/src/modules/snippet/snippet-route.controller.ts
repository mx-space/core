import { All, Request, Response } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { IsAuthenticated } from '~/common/decorators/role.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { createMockedContextResponse } from '../serverless/mock-response.util'
import { ServerlessService } from '../serverless/serverless.service'
import type { SnippetModel } from './snippet.model'
import { SnippetService } from './snippet.service'

const MAX_PREFIX_DEPTH = 10

@ApiController('s')
export class SnippetRouteController {
  constructor(
    private readonly snippetService: SnippetService,
    private readonly serverlessService: ServerlessService,
  ) {}

  @All('*')
  @Throttle({
    default: {
      limit: 100,
      ttl: 5000,
    },
  })
  @HTTPDecorators.Bypass
  async handleCustomPath(
    @IsAuthenticated() isAuthenticated: boolean,
    @Request() req: FastifyRequest,
    @Response() reply: FastifyReply,
  ) {
    const rawPath = req.url
    const sPrefixIndex = rawPath.indexOf('/s')
    const subPath = rawPath.slice(Math.max(0, sPrefixIndex + 2))
    const path = subPath.replaceAll(/^\/+|\/+$/g, '')

    const method = req.method.toUpperCase()

    // 1. Exact match — data type snippet
    const dataSnippet = await this.snippetService.getSnippetByCustomPath(path)

    if (dataSnippet) {
      if (dataSnippet.private && !isAuthenticated) {
        throw new BizException(ErrorCodeEnum.SnippetPrivate)
      }

      // check cache
      let cached: string | null = null
      if (isAuthenticated) {
        cached =
          (
            await Promise.all(
              (['public', 'private'] as const).map((type) =>
                this.snippetService.getCachedSnippetByCustomPath(path, type),
              ),
            )
          ).find(Boolean) || null
      } else {
        cached = await this.snippetService.getCachedSnippetByCustomPath(
          path,
          'public',
        )
      }

      if (cached) {
        const json = JSON.safeParse(cached)
        return reply.send(json || cached)
      }

      const attached = await this.snippetService.attachSnippet(dataSnippet)
      await this.snippetService.cacheSnippetByCustomPath(
        path,
        !!attached.private,
        attached.data,
      )
      return reply.send(attached.data)
    }

    // 2. Exact match — function type snippet
    const fnSnippet = await this.snippetService.getFunctionSnippetByCustomPath(
      path,
      method,
    )
    if (fnSnippet) {
      return this.executeFunction(fnSnippet, isAuthenticated, req, reply)
    }

    // 3. Prefix match for function type (extra path info)
    const segments = path.split('/')
    const candidatePaths: string[] = []
    for (
      let i = segments.length - 1;
      i >= 1 && candidatePaths.length < MAX_PREFIX_DEPTH;
      i--
    ) {
      candidatePaths.push(segments.slice(0, i).join('/'))
    }

    if (candidatePaths.length > 0) {
      const prefixSnippet =
        await this.snippetService.getFunctionSnippetByCustomPathPrefix(
          candidatePaths,
          method,
        )
      if (prefixSnippet) {
        return this.executeFunction(prefixSnippet, isAuthenticated, req, reply)
      }
    }

    throw new BizException(ErrorCodeEnum.SnippetNotFound)
  }

  private async executeFunction(
    snippet: SnippetModel,
    isAuthenticated: boolean,
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    if (!snippet.enable) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'serverless function is not enabled',
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
}
