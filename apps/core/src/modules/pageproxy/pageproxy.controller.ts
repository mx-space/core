import { createReadStream, existsSync, statSync } from 'node:fs'
import fs from 'node:fs/promises'
import path, { extname, join } from 'node:path'
import { Controller, Get, Query, Req, Res } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { LOCAL_ADMIN_ASSET_PATH } from '~/constants/path.constant'
import { AssetService } from '~/processors/helper/helper.asset.service'
import { render } from 'ejs'
import { FastifyReply, FastifyRequest } from 'fastify'
import { lookup } from 'mime-types'
import type { Observable } from 'rxjs'
import { UpdateService } from '../update/update.service'
import { PageProxyService } from './pageproxy.service'

@Controller('/')
@SkipThrottle()
export class PageProxyController {
  constructor(
    private readonly service: PageProxyService,
    private readonly updateService: UpdateService,
    private readonly assetService: AssetService,
  ) {}

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

      reply.code(200).type('text/html').send(String(log))
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
        await this.updateService.getLatestAdminVersion().catch((error) => {
          this.fetchErrorMsg = error.message

          throw error
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
    } catch (error) {
      isDev && console.error(error)
      return reply.code(500).send({
        message: error.message,
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
