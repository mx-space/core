import { All, Request, Response } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { FastifyReply, FastifyRequest } from 'fastify'

import {
  ApiController,
  apiRoutePrefix,
} from '~/common/decorators/api-controller.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { HasAdminAccess } from '~/common/decorators/role.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'

import { createMockedContextResponse } from '../serverless/mock-response.util'
import { ServerlessService } from '../serverless/serverless.service'
import { SnippetType } from './snippet.schema'
import { SnippetService } from './snippet.service'
import type { SnippetRow } from './snippet.types'

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
  @HTTPDecorators.RawResponse
  async handleCustomPath(
    @HasAdminAccess() hasAdminAccess: boolean,
    @Request() req: FastifyRequest,
    @Response() reply: FastifyReply,
  ) {
    const rawPath = req.url.split('?')[0]
    const sPrefixIndex = rawPath.indexOf('/s')
    const subPath = rawPath.slice(Math.max(0, sPrefixIndex + 2))
    const path = subPath.replaceAll(/^\/+|\/+$/g, '')

    const method = req.method.toUpperCase()

    // 1. Exact match — data type snippet
    const dataSnippet = await this.snippetService.getSnippetByPath(path)

    if (dataSnippet) {
      if (dataSnippet.private && !hasAdminAccess) {
        throw createAppException(AppErrorCode.SNIPPET_PRIVATE)
      }

      // check cache
      const cached = hasAdminAccess
        ? (
            await Promise.all(
              (['public', 'private'] as const).map((type) =>
                this.snippetService.getCachedSnippetByPath(path, type),
              ),
            )
          ).find(Boolean) || null
        : await this.snippetService.getCachedSnippetByPath(path, 'public')

      if (cached) {
        const json = JSON.safeParse(cached)
        if (dataSnippet.type === SnippetType.Skill) {
          this.applySkillResponseHeaders(reply)
        }
        return reply.send(json || cached)
      }

      const attached = await this.snippetService.attachSnippet(dataSnippet)
      await this.snippetService.cacheSnippet(attached, attached.data)
      if (dataSnippet.type === SnippetType.Skill) {
        this.applySkillResponseHeaders(reply)
      }
      return reply.send(attached.data)
    }

    // 2. Exact match — function type snippet
    const fnSnippet = await this.snippetService.getFunctionSnippetByPath(
      path,
      method,
    )
    if (fnSnippet) {
      return this.executeFunction(fnSnippet, hasAdminAccess, req, reply)
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
        await this.snippetService.getFunctionSnippetByPathPrefix(
          candidatePaths,
          method,
        )
      if (prefixSnippet) {
        return this.executeFunction(prefixSnippet, hasAdminAccess, req, reply)
      }
    }

    const skillIndex = `${path}/SKILL.md`
    const skillSnippet = await this.snippetService.getSnippetByPath(skillIndex)
    if (skillSnippet) {
      return reply.redirect(`${apiRoutePrefix}/s/${skillIndex}`, 302)
    }

    throw createAppException(AppErrorCode.SNIPPET_NOT_FOUND)
  }

  private applySkillResponseHeaders(reply: FastifyReply) {
    reply.header('Content-Type', 'text/markdown; charset=utf-8')
    reply.header(
      'Cache-Control',
      'public, max-age=300, stale-while-revalidate=3600',
    )
  }

  private async executeFunction(
    snippet: SnippetRow,
    hasAdminAccess: boolean,
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    if (!snippet.enable) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'serverless function is not enabled',
      })
    }

    if (snippet.private && !hasAdminAccess) {
      throw createAppException(AppErrorCode.SERVERLESS_NO_PERMISSION)
    }

    const result =
      await this.serverlessService.injectContextIntoServerlessFunctionAndCall(
        snippet,
        { req, res: createMockedContextResponse(reply), hasAdminAccess },
      )

    if (!reply.sent) {
      return reply.send(result)
    }
  }
}
