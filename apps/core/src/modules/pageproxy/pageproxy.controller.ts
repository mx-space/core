import { createReadStream, existsSync, statSync } from 'node:fs'
import fs from 'node:fs/promises'
import path, { extname, join } from 'node:path'
import { Controller, Get, Query, Req, Res } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { LOCAL_ADMIN_ASSET_PATH } from '~/constants/path.constant'
import { AssetService } from '~/processors/helper/helper.asset.service'
import ejs from 'ejs'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { lookup } from 'mime-types'
import { AdminDownloadManager } from './admin-download.manager'
import { PageProxyService } from './pageproxy.service'

@Controller('/')
@SkipThrottle()
export class PageProxyController {
  constructor(
    private readonly service: PageProxyService,
    private readonly assetService: AssetService,
    private readonly downloadManager: AdminDownloadManager,
  ) {}

  @Get('/proxy/qaqdmin')
  @HTTPDecorators.Bypass
  async getLocalBundledAdmin(@Query() query: any, @Res() reply: FastifyReply) {
    if ((await this.service.checkCanAccessAdminProxy()) === false) {
      return reply.type('application/json').status(403).send({
        message: 'admin proxy not enabled',
      })
    }

    if (query.log) {
      return this.sendResponse(reply, this.downloadManager.handleLogPolling())
    }

    const entryPath = path.join(LOCAL_ADMIN_ASSET_PATH, 'index.html')
    if (!existsSync(entryPath)) {
      return this.sendResponse(
        reply,
        await this.downloadManager.handleDownloadStart(),
      )
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
      const isDev = process.env.NODE_ENV === 'development'
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
      { encoding: 'utf-8' },
    )) as string

    const urls = await this.service.getUrls()
    reply.type('text/html').send(
      ejs.render(template, {
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
    const assetPath = join(LOCAL_ADMIN_ASSET_PATH, relativePath)

    if (!existsSync(assetPath)) {
      return reply.code(404).send().callNotFound()
    }

    if (!statSync(assetPath).isFile()) {
      return reply.type('application/json').code(400).send({
        message: "can't serve directory",
      })
    }

    try {
      const stream = createReadStream(assetPath)
      const minetype = lookup(extname(assetPath))

      reply.header('cache-control', 'public, max-age=31536000')
      reply.header(
        'expires',
        new Date(Date.now() + 31536000 * 1000).toUTCString(),
      )

      stream.on('error', (err) => {
        console.error('Stream error:', err)
        if (!reply.sent) {
          reply.code(500).send({ message: 'File read error' })
        }
      })

      if (minetype) {
        return reply.type(minetype).send(stream)
      } else {
        return reply.send(stream)
      }
    } catch (error) {
      console.error('Asset serving error:', error)
      return reply.code(500).send({
        message: 'Failed to serve asset',
      })
    }
  }

  private sendResponse(
    reply: FastifyReply,
    response: { code: number; type?: string; body?: string },
  ) {
    const res = reply.code(response.code)
    if (response.type) {
      res.type(response.type)
    }
    return res.send(response.body)
  }
}
