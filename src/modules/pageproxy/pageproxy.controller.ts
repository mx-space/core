import { CacheTTL, Controller, Get, Header } from '@nestjs/common'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
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
  ) {}

  @Get('/qaqdmin')
  @Header('Content-Type', 'text/html')
  @HTTPDecorators.Bypass
  @CacheTTL(60 * 10)
  async proxyAdmin() {
    const {
      adminExtra,
      url: { wsUrl, serverUrl, webUrl },
    } = await this.configs.waitForConfigReady()
    if (!adminExtra.enableAdminProxy && !isDev) {
      return '<h1>Admin Proxy is disabled</h1>'
    }
    const indexEntryUrl = `https://raw.githubusercontent.com/mx-space/admin-next/gh-pages/index.html`
    let entry = await (await fetch(indexEntryUrl)).text()
    entry = entry.replace(
      `<!-- injectable script -->`,
      `<script>${`window.injectData = ${JSON.stringify({
        BASE_API: serverUrl,
        GATEWAY: wsUrl,
        LOGIN_BG: adminExtra.background,
        TITLE: adminExtra.title,
        WEB_URL: webUrl,
        INIT: await this.initService.isInit(),
      } as IInjectableData)}`}</script>`,
    )
    return entry
  }
}
