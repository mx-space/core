import { Controller, Get, Header } from '@nestjs/common'
import { API_VERSION } from '~/app.config'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { RedisKeys } from '~/constants/cache.constant'
import { CacheService } from '~/processors/cache/cache.service'
import { getRedisKey } from '~/utils/redis.util'
import { ConfigsService } from '../configs/configs.service'
import { InitService } from '../init/init.service'

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
  async proxyAdmin() {
    const {
      adminExtra,
      url: { webUrl },
    } = await this.configs.waitForConfigReady()
    if (!adminExtra.enableAdminProxy && !isDev) {
      return '<h1>Admin Proxy is disabled</h1>'
    }

    let entry =
      (await this.cacheService.get<string>(getRedisKey(RedisKeys.AdminPage))) ||
      (await (async () => {
        const indexEntryUrl = `https://raw.githubusercontent.com/mx-space/admin-next/gh-pages/index.html`
        const indexEntryCdnUrl = `https://cdn.jsdelivr.net/gh/mx-space/admin-next@gh-pages/index.html?t=${+new Date()}`
        return await Promise.any([
          // 龟兔赛跑, 乌龟先跑
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          fetch(indexEntryUrl).then((res) => res.text()),
          sleep(1000).then(async () => (await fetch(indexEntryCdnUrl)).text()),
        ])
      })())

    await this.cacheService.set(getRedisKey(RedisKeys.AdminPage), entry, {
      ttl: 10 * 60,
    })

    entry = entry.replace(
      `<!-- injectable script -->`,
      `<script>${`window.injectData = ${JSON.stringify({
        LOGIN_BG: adminExtra.background,
        TITLE: adminExtra.title,
        WEB_URL: webUrl,
        INIT: await this.initService.isInit(),
      } as IInjectableData)}`}
      window.injectData.BASE_API = location.origin + '${
        !isDev ? '/api/v' + API_VERSION : ''
      }';
      window.injectData.GATEWAY = location.origin;
      </script>`,
    )
    return entry
  }
}
