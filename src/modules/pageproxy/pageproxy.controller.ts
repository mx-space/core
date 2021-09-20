import { Controller, Get, Header, Query, Session } from '@nestjs/common'
import * as secureSession from 'fastify-secure-session'
import { API_VERSION } from '~/app.config'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { RedisKeys } from '~/constants/cache.constant'
import { CacheService } from '~/processors/cache/cache.service'
import { getRedisKey } from '~/utils/redis.util'
import { ConfigsService } from '../configs/configs.service'
import { InitService } from '../init/init.service'
import { PageProxyDebugDto } from './pageproxy.dto'

interface IInjectableData {
  BASE_API: null | string
  WEB_URL: null | string
  GATEWAY: null | string
  LOGIN_BG: null | string
  TITLE: null | string

  INIT: null | boolean
}

@Controller('/')
@ApiName
export class PageProxyController {
  constructor(
    private readonly configs: ConfigsService,
    private readonly initService: InitService,
    private readonly cacheService: CacheService,
  ) {}

  @Get('/qaqdmin')
  @Header('Content-Type', 'text/html')
  @HTTPDecorators.Bypass
  async proxyAdmin(
    @Session() session: secureSession.Session,
    @Query() query: PageProxyDebugDto,
  ) {
    const {
      adminExtra,
      url: { webUrl },
    } = await this.configs.waitForConfigReady()
    if (!adminExtra.enableAdminProxy && !isDev) {
      return '<h1>Admin Proxy is disabled</h1>'
    }
    const {
      __apiUrl: apiUrl,
      __gatewayUrl: gatewayUrl,
      __onlyGithub: onlyGithub,
      __debug: debug,
    } = query
    session.options({ maxAge: 1000 * 60 * 10 })
    if (apiUrl) {
      session.set('__apiUrl', apiUrl)
    }

    if (gatewayUrl) {
      session.set('__gatewayUrl', gatewayUrl)
    }

    if (debug === false) {
      session.delete()
    }

    let entry =
      (!onlyGithub &&
        (await this.cacheService.get<string>(
          getRedisKey(RedisKeys.AdminPage),
        ))) ||
      (await (async () => {
        const indexEntryUrl = `https://raw.githubusercontent.com/mx-space/admin-next/gh-pages/index.html`
        const indexEntryCdnUrl = `https://cdn.jsdelivr.net/gh/mx-space/admin-next@gh-pages/index.html?t=${+new Date()}`
        const tasks = [
          // 龟兔赛跑, 乌龟先跑
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          fetch(indexEntryUrl).then((res) => res.text()),
        ]
        if (!onlyGithub) {
          tasks.push(
            sleep(1000).then(async () =>
              (await fetch(indexEntryCdnUrl)).text(),
            ),
          )
        }
        return await Promise.any(tasks)
      })())

    await this.cacheService.set(getRedisKey(RedisKeys.AdminPage), entry, {
      ttl: 10 * 60,
    })

    const sessionInjectableData = {
      BASE_API: session.get('__apiUrl'),
      GATEWAY: session.get('__gatewayUrl'),
    }

    entry = entry.replace(
      `<!-- injectable script -->`,
      `<script>${`window.injectData = ${JSON.stringify({
        LOGIN_BG: adminExtra.background,
        TITLE: adminExtra.title,
        WEB_URL: webUrl,
        INIT: await this.initService.isInit(),
      } as IInjectableData)}`}
     ${
       sessionInjectableData.BASE_API
         ? `window.injectData.BASE_API = '${sessionInjectableData.BASE_API}'`
         : `window.injectData.BASE_API = location.origin + '${
             !isDev ? '/api/v' + API_VERSION : ''
           }';`
     }
      ${
        sessionInjectableData.GATEWAY
          ? `window.injectData.GATEWAY = '${sessionInjectableData.GATEWAY}';`
          : `window.injectData.GATEWAY = location.origin;`
      }
      </script>`,
    )
    return entry
  }
}
