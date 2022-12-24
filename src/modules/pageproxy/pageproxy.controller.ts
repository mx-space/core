import { FastifyReply, FastifyRequest } from 'fastify'
import { createReadStream, existsSync, statSync } from 'fs'
import fs from 'fs/promises'
import { isNull } from 'lodash'
import { lookup } from 'mime-types'
import PKG from 'package.json'
import { extname, join } from 'path'

import {
  Controller,
  Get,
  InternalServerErrorException,
  Query,
  Req,
  Res,
} from '@nestjs/common'

import { Cookies } from '~/common/decorator/cookie.decorator'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { RedisKeys } from '~/constants/cache.constant'
import { LOCAL_ADMIN_ASSET_PATH } from '~/constants/path.constant'
import { CacheService } from '~/processors/redis/cache.service'
import { getRedisKey } from '~/utils/redis.util'

import { dashboard } from '../../../package.json'
import { PageProxyDebugDto } from './pageproxy.dto'
import { PageProxyService } from './pageproxy.service'

@Controller('/')
@ApiName
export class PageProxyController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly service: PageProxyService,
  ) {}

  @Get('/qaqdmin')
  @HTTPDecorators.Bypass
  async proxyAdmin(
    @Cookies() cookies: KV<string>,
    @Query() query: PageProxyDebugDto,
    @Res() reply: FastifyReply,
  ) {
    // if want to access local, skip this route logic

    if (query.__local) {
      reply.redirect('/proxy/qaqdmin')
      return
    }

    if ((await this.service.checkCanAccessAdminProxy()) === false) {
      return reply.type('application/json').status(403).send({
        message: 'admin proxy not enabled',
      })
    }
    const {
      __apiUrl: apiUrl,
      __gatewayUrl: gatewayUrl,
      __onlyGithub: onlyGithub,
      __debug: debug,
      __version: adminVersion = dashboard.version,
      __purge,
    } = query

    if (__purge) {
      await this.cacheService.getClient().del(getRedisKey(RedisKeys.AdminPage))
    }
    if (apiUrl) {
      reply.setCookie('__apiUrl', apiUrl, { maxAge: 1000 * 60 * 10 })
    }

    if (gatewayUrl) {
      reply.setCookie('__gatewayUrl', gatewayUrl, { maxAge: 1000 * 60 * 10 })
    }

    if (debug === false) {
      reply.clearCookie('__apiUrl')
      reply.clearCookie('__gatewayUrl')
    }

    const source: { text: string; from: string } = await (async () => {
      // adminVersion 如果传入 latest 会被转换 null, 这里要判断 undefined
      if (!onlyGithub && typeof adminVersion == 'undefined') {
        const fromRedis = await this.cacheService.get<string>(
          getRedisKey(RedisKeys.AdminPage),
        )

        if (fromRedis) {
          return {
            text: fromRedis,
            from: 'redis',
          }
        }
      }
      let latestVersion = ''

      if (isNull(adminVersion)) {
        try {
          latestVersion =
            await this.service.getAdminLastestVersionFromGHRelease()
        } catch (e) {
          reply.type('application/json').status(500).send({
            message: '从获取 GitHub 获取数据失败，连接超时',
          })
          throw e
        }
      }
      const v = adminVersion || latestVersion
      const indexEntryUrl = `https://raw.githubusercontent.com/${PKG.dashboard.repo}/page_v${v}/index.html`
      const indexEntryCdnUrl = `https://fastly.jsdelivr.net/gh/${PKG.dashboard.repo}@page_v${v}/index.html`
      const tasks = [
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        fetch(indexEntryUrl)
          .then((res) => res.text())
          .then((text) => ({ text, from: 'github' })),
      ]
      if (!onlyGithub) {
        tasks.push(
          fetch(indexEntryCdnUrl)
            .then((res) => res.text())
            .then((text) => ({ text, from: 'jsdelivr' })),
        )
      }

      return await Promise.any(tasks).catch((e) => {
        const err = '网络连接异常，所有请求均失败，无法获取后台入口文件'
        reply.type('application/json').status(500).send({ message: err })
        throw new InternalServerErrorException(err)
      })
    })()

    await this.cacheService.set(getRedisKey(RedisKeys.AdminPage), source.text, {
      ttl: 10 * 60,
    })

    const sessionInjectableData =
      debug === false
        ? {}
        : {
            BASE_API: apiUrl ?? cookies['__apiUrl'],
            GATEWAY: gatewayUrl ?? cookies['__gatewayUrl'],
          }
    const entry = await this.service.injectAdminEnv(source.text, {
      BASE_API: sessionInjectableData.BASE_API,
      GATEWAY: sessionInjectableData.GATEWAY,
      from: source.from,
    })

    return reply.type('text/html').send(entry)
  }

  @Get('/proxy/qaqdmin')
  @HTTPDecorators.Bypass
  async getLocalBundledAdmin(@Res() reply: FastifyReply) {
    if ((await this.service.checkCanAccessAdminProxy()) === false) {
      return reply.type('application/json').status(403).send({
        message: 'admin proxy not enabled',
      })
    }
    const entryPath = path.join(LOCAL_ADMIN_ASSET_PATH, 'index.html')
    const isAssetPathIsExist = existsSync(entryPath)
    if (!isAssetPathIsExist) {
      reply.code(404).type('text/html')
        .send(`<p>Local Admin Assets is not found. Navigator to page proxy in 3 second. </p><script>setTimeout(() => {
        location.href = '/qaqdmin'
      }, 3000);</script>`)
      return
    }
    try {
      const entry = await fs.readFile(entryPath, 'utf8')

      const injectEnv = await this.service.injectAdminEnv(entry, {
        ...(await this.service.getUrlFromConfig()),
        from: 'server',
      })
      return reply
        .type('text/html')
        .send(this.service.rewriteAdminEntryAssetPath(injectEnv))
    } catch (e) {
      isDev && console.error(e)
      return reply.code(500).send({
        message: e.message,
      })
    }
  }

  @Get('/proxy/*')
  @HTTPDecorators.Bypass
  async proxyAssetRoute(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    if ((await this.service.checkCanAccessAdminProxy()) === false) {
      return reply.type('application/json').status(403).send({
        message: 'admin proxy not enabled, proxy assets is forbidden',
      })
    }

    const url = request.url
    const relativePath = url.replace(/^\/proxy\//, '')
    const path = join(LOCAL_ADMIN_ASSET_PATH, relativePath)

    const isPathExist = existsSync(path)
    if (!isPathExist) {
      return reply.code(404).send().callNotFound()
    }

    const isFile = statSync(path).isFile()
    if (!isFile) {
      return reply.type('application/json').code(400).send({
        message: "can't pipe directory",
      })
    }
    const stream = createReadStream(path)

    const minetype = lookup(extname(path))
    reply.header('cache-control', 'public, max-age=31536000')
    reply.header(
      'expires',
      new Date(Date.now() + 31536000 * 1000).toUTCString(),
    )
    if (minetype) {
      return reply.type(minetype).send(stream)
    } else {
      return reply.send(stream)
    }
  }
}
