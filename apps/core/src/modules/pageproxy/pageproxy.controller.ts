import { createReadStream, existsSync, statSync } from 'fs'
import fs from 'fs/promises'
import { extname, join } from 'path'
import { render } from 'ejs'
import { FastifyReply, FastifyRequest } from 'fastify'
import { isNull } from 'lodash'
import { lookup } from 'mime-types'
import PKG from 'package.json'
import type { Observable } from 'rxjs'

import {
  Controller,
  Get,
  InternalServerErrorException,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'

import { Cookies } from '~/common/decorators/cookie.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { RedisKeys } from '~/constants/cache.constant'
import { LOCAL_ADMIN_ASSET_PATH } from '~/constants/path.constant'
import { AssetService } from '~/processors/helper/helper.asset.service'
import { CacheService } from '~/processors/redis/cache.service'
import { getRedisKey } from '~/utils/redis.util'

import { dashboard } from '../../../package.json'
import { UpdateService } from '../update/update.service'
import { PageProxyDebugDto } from './pageproxy.dto'
import { PageProxyService } from './pageproxy.service'

@Controller('/')
@SkipThrottle()
export class PageProxyController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly service: PageProxyService,
    private readonly updateService: UpdateService,
    private readonly assetService: AssetService,
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

    await this.cacheService.set(
      getRedisKey(RedisKeys.AdminPage),
      source.text,
      10 * 60 * 1000,
    )

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

  private fetchObserver$: Observable<string> | null
  private fetchLogs: string[] | null
  private fetchErrorMsg: string | null

  @Get('/proxy/qaqdmin')
  @HTTPDecorators.Bypass
  async getLocalBundledAdmin(@Query() query: any, @Res() reply: FastifyReply) {
    if ((await this.service.checkCanAccessAdminProxy()) === false) {
      return reply.type('application/json').status(403).send({
        message: 'admin proxy not enabled',
      })
    }
    if (this.fetchObserver$ && query.log) {
      if (this.fetchLogs === null) {
        return reply.code(204)
      }
      const log = this.fetchLogs.pop() || '...'

      reply.code(200).type('text/html').send(`${log}`)
      return
    }

    if (query.log) {
      if (this.fetchErrorMsg) {
        reply.code(403).type('text/html').send(this.fetchErrorMsg)
        this.fetchErrorMsg = null
      } else {
        reply.code(200).type('text/html').send('...')
      }
      return
    }

    const entryPath = path.join(LOCAL_ADMIN_ASSET_PATH, 'index.html')
    const isAssetPathIsExist = existsSync(entryPath)
    if (!isAssetPathIsExist) {
      this.fetchLogs = []

      const html = await this.assetService.getAsset(
        '/render/init-dashboard.html',
        { encoding: 'utf-8' },
      )
      reply.type('text/html').send(html)

      this.fetchObserver$ = this.updateService.downloadAdminAsset(
        await this.updateService.getLatestAdminVersion().catch((err) => {
          this.fetchErrorMsg = err.message

          throw err
        }),
      )

      const cleanup = () => {
        this.fetchObserver$ = null
        this.fetchLogs = null
      }

      this.fetchObserver$.subscribe({
        next: (value) => {
          this.fetchLogs?.push(value)
        },
        error: cleanup,
        complete: cleanup,
      })

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

  @Get('/proxy/qaqdmin/dev-proxy')
  @HTTPDecorators.Bypass
  async proxyLocalDev(@Res() reply: FastifyReply) {
    const template = (await this.assetService.getAsset(
      '/render/local-dev.ejs',
      {
        encoding: 'utf-8',
      },
    )) as string

    const urls = await this.service.getUrls()
    reply.type('text/html').send(
      render(template, {
        web_url: urls.webUrl,
        gateway_url: urls.wsUrl,
        base_api: urls.serverUrl,
      }),
    )
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
