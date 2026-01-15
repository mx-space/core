import { createReadStream, existsSync, statSync } from 'node:fs'
import fs from 'node:fs/promises'
import path, { extname, join } from 'node:path'
import {
  Controller,
  Get,
  InternalServerErrorException,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { dashboard } from '~/../package.json'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { RedisKeys } from '~/constants/cache.constant'
import { LOCAL_ADMIN_ASSET_PATH } from '~/constants/path.constant'
import { AssetService } from '~/processors/helper/helper.asset.service'
import { CacheService } from '~/processors/redis/cache.service'
import { getRedisKey } from '~/utils/redis.util'
import { render } from 'ejs'
import { FastifyReply, FastifyRequest } from 'fastify'
import { isNull } from 'lodash'
import { lookup } from 'mime-types'
import { Observable } from 'rxjs'
import { UpdateService } from '../update/update.service'
import { PageProxyService } from './pageproxy.service'

const PKG = { dashboard }

interface DownloadState {
  observer: Observable<string> | null
  logs: string[]
  errorMsg: string | null
  isDownloading: boolean
  startTime: number
  lastActivity: number
}

@Controller('/')
@SkipThrottle()
export class PageProxyController {
  private downloadState: DownloadState = {
    observer: null,
    logs: [],
    errorMsg: null,
    isDownloading: false,
    startTime: 0,
    lastActivity: 0,
  }

  private readonly DOWNLOAD_TIMEOUT = 600000 // 10分钟超时
  private readonly LOG_RETENTION_TIME = 300000 // 5分钟日志保留时间

  constructor(
    private readonly service: PageProxyService,
    private readonly updateService: UpdateService,
    private readonly assetService: AssetService,
    private readonly cacheService: CacheService,
  ) {}

  @Get('/qaqdmin')
  @HTTPDecorators.Bypass
  async getAdminEntry(
    @Query('current_version') adminVersion: string,
    @Query('only_github') onlyGithub: boolean,
    @Res() reply: FastifyReply,
  ) {
    const source: { text: string; from: string } = await (async () => {
      if (!onlyGithub && typeof adminVersion == 'undefined') {
        const fromRedis = await this.cacheService.get<string>(
          getRedisKey(RedisKeys.AdminPage),
        )
        if (fromRedis) {
          return { text: fromRedis, from: 'redis' }
        }
      }
      let latestVersion = ''

      if (isNull(adminVersion)) {
        try {
          latestVersion =
            await this.service.getAdminLastestVersionFromGHRelease()
        } catch (error) {
          reply.type('application/json').status(500).send({
            message: '从获取 GitHub 获取数据失败，连接超时',
          })
          throw error
        }
      }
      const v = adminVersion || latestVersion
      const indexEntryUrl = `https://raw.githubusercontent.com/${PKG.dashboard.repo}/page_v${v}/index.html`
      const indexEntryCdnUrl = `https://fastly.jsdelivr.net/gh/${PKG.dashboard.repo}@page_v${v}/index.html`

      // 改进的并发请求处理，增加超时和错误处理
      const createFetchTask = (url: string, source: string) => {
        return fetch(url, {
          signal: AbortSignal.timeout(30000), // 30秒超时
          headers: {
            'User-Agent': 'Mix-Space-Admin-Proxy',
          },
        })
          .then(async (res) => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`)
            }
            const text = await res.text()
            if (!text || text.length < 100) {
              throw new Error('Response content is too short or empty')
            }
            return { text, from: source }
          })
          .catch((error) => {
            const errorMsg =
              error instanceof Error ? error.message : String(error)
            console.warn(`Failed to fetch from ${source}: ${errorMsg}`)
            throw error
          })
      }

      const tasks = [createFetchTask(indexEntryUrl, 'github')]

      if (!onlyGithub) {
        tasks.push(createFetchTask(indexEntryCdnUrl, 'jsdelivr'))
      }

      return await Promise.any(tasks).catch((error) => {
        const err = '网络连接异常，所有请求均失败，无法获取后台入口文件'
        reply
          .type('application/json')
          .status(500)
          .send({
            message: err,
            details:
              error instanceof AggregateError
                ? error.errors.map((err) => err.message)
                : [String(error)],
          })
        throw new InternalServerErrorException(err)
      })
    })()

    reply.header('x-from', source.from)
    return reply.type('text/html').send(source.text)
  }

  @Get('/proxy/qaqdmin')
  @HTTPDecorators.Bypass
  async getLocalBundledAdmin(@Query() query: any, @Res() reply: FastifyReply) {
    if ((await this.service.checkCanAccessAdminProxy()) === false) {
      return reply.type('application/json').status(403).send({
        message: 'admin proxy not enabled',
      })
    }

    // 处理日志轮询请求
    if (query.log) {
      return this.handleLogPolling(reply)
    }

    const entryPath = path.join(LOCAL_ADMIN_ASSET_PATH, 'index.html')
    const isAssetPathIsExist = existsSync(entryPath)

    if (!isAssetPathIsExist) {
      return this.handleDownloadStart(reply)
    }

    // 资源存在，返回本地管理界面
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
    const assetPath = join(LOCAL_ADMIN_ASSET_PATH, relativePath)

    const isPathExist = existsSync(assetPath)
    if (!isPathExist) {
      return reply.code(404).send().callNotFound()
    }

    const isFile = statSync(assetPath).isFile()
    if (!isFile) {
      return reply.type('application/json').code(400).send({
        message: "can't serve directory",
      })
    }

    try {
      const stream = createReadStream(assetPath)
      const minetype = lookup(extname(assetPath))

      // 设置缓存头
      reply.header('cache-control', 'public, max-age=31536000')
      reply.header(
        'expires',
        new Date(Date.now() + 31536000 * 1000).toUTCString(),
      )

      // 添加错误处理
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

  /**
   * 处理日志轮询请求
   */
  private handleLogPolling(reply: FastifyReply) {
    // 检查下载超时
    if (
      this.downloadState.isDownloading &&
      Date.now() - this.downloadState.lastActivity > this.DOWNLOAD_TIMEOUT
    ) {
      this.cleanupDownload()
      this.downloadState.errorMsg =
        'Download timeout - no activity for 10 minutes'
    }

    // 如果有错误消息
    if (this.downloadState.errorMsg) {
      const errorMsg = this.downloadState.errorMsg
      this.downloadState.errorMsg = null
      return reply.code(500).type('text/html').send(`
        <div style="color: red; font-weight: bold;">
          Download Failed: ${errorMsg}
        </div>
        <div style="margin-top: 10px;">
          <button onclick="window.location.reload()">Retry Download</button>
        </div>
      `)
    }

    // 如果下载完成
    if (
      !this.downloadState.isDownloading &&
      this.downloadState.logs.length === 0
    ) {
      return reply.code(204).send()
    }

    // 返回日志
    if (this.downloadState.logs.length > 0) {
      const log = this.downloadState.logs.shift() || '...'
      this.downloadState.lastActivity = Date.now()
      return reply.code(200).type('text/html').send(log)
    }

    // 下载进行中但没有新日志
    return reply.code(200).type('text/html').send('...')
  }

  /**
   * 处理下载开始
   */
  private handleDownloadStart(reply: FastifyReply) {
    // 如果已经在下载中
    if (this.downloadState.isDownloading) {
      return this.renderDownloadPage(reply, 'Download already in progress...')
    }

    // 开始新的下载
    this.initializeDownload()

    this.updateService
      .getLatestAdminVersion()
      .then((version) => {
        this.downloadState.observer =
          this.updateService.downloadAdminAsset(version)
        this.setupDownloadSubscription()
      })
      .catch((error) => {
        this.downloadState.errorMsg = error.message
        this.downloadState.isDownloading = false
      })

    return this.renderDownloadPage(reply, 'Starting download...')
  }

  /**
   * 初始化下载状态
   */
  private initializeDownload() {
    this.downloadState = {
      observer: null,
      logs: [],
      errorMsg: null,
      isDownloading: true,
      startTime: Date.now(),
      lastActivity: Date.now(),
    }
  }

  /**
   * 设置下载订阅
   */
  private setupDownloadSubscription() {
    if (!this.downloadState.observer) return

    this.downloadState.observer.subscribe({
      next: (value) => {
        this.downloadState.logs.push(value)
        this.downloadState.lastActivity = Date.now()

        // 限制日志数量，防止内存溢出
        if (this.downloadState.logs.length > 1000) {
          this.downloadState.logs = this.downloadState.logs.slice(-500)
        }
      },
      error: (err) => {
        this.downloadState.errorMsg = err.message || String(err)
        this.cleanupDownload()
      },
      complete: () => {
        // 添加延迟，确保最后的日志被处理
        setTimeout(() => {
          this.cleanupDownload()
        }, 1000)
      },
    })
  }

  /**
   * 清理下载状态
   */
  private cleanupDownload() {
    this.downloadState.isDownloading = false
    this.downloadState.observer = null

    // 延迟清理日志，给前端时间获取最后的日志
    setTimeout(() => {
      this.downloadState.logs = []
    }, this.LOG_RETENTION_TIME)
  }

  /**
   * 渲染下载页面
   */
  private async renderDownloadPage(
    reply: FastifyReply,
    initialMessage: string,
  ) {
    try {
      const possiblePaths = [
        join(process.cwd(), 'scripts', 'download-admin.ejs'),
        join(process.cwd(), 'apps', 'core', 'scripts', 'download-admin.ejs'),
      ]
      const templatePath = possiblePaths.find((path) => existsSync(path))
      const template = templatePath
        ? await fs.readFile(templatePath, 'utf-8')
        : ((await this.assetService.getAsset('/download-admin.ejs', {
            encoding: 'utf-8',
          })) as string)

      return reply.code(404).type('text/html').send(
        render(template, {
          initialMessage,
        }),
      )
    } catch {
      // Fallback if template fails
      return reply.code(404).type('text/html').send(`
        <h1>Downloading Admin Assets...</h1>
        <p>${initialMessage}</p>
        <p>Please wait or refresh.</p>
      `)
    }
  }
}
