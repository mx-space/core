import path from 'node:path'
import { URL } from 'node:url'
import { Injectable, InternalServerErrorException } from '@nestjs/common'
import PKG from '~/../package.json'
import { API_VERSION } from '~/app.config'
import { parseHTML } from 'linkedom'
import { ConfigsService } from '../configs/configs.service'
import { UserService } from '../user/user.service'

@Injectable()
export class PageProxyService {
  constructor(
    private readonly configs: ConfigsService,
    private readonly userService: UserService,
  ) {}

  async checkCanAccessAdminProxy() {
    const { adminExtra } = await this.configs.waitForConfigReady()
    if (!adminExtra.enableAdminProxy && !isDev) {
      return false
    }
    return true
  }

  /**
   * @returns {Promise<string>} version `x.y.z` , not startwith `v`
   * @throws {Error}
   */
  async getAdminLastestVersionFromGHRelease(): Promise<string> {
    const { githubToken } = await this.configs.get(
      'thirdPartyServiceIntegration',
    )
    // tag_name: v3.6.x
    const { tag_name } = await fetch(
      `https://api.github.com/repos/${PKG.dashboard.repo}/releases/latest`,
      {
        headers: {
          Authorization: githubToken || `Bearer ${githubToken}`,
        },
      },
    ).then((data) => data.json())

    return tag_name.replace(/^v/, '')
  }

  async injectAdminEnv(
    htmlEntry: string,
    env: {
      from?: string
      BASE_API?: string
      GATEWAY?: string
      [key: string]: string | undefined
    },
  ) {
    const config = await this.configs.waitForConfigReady()
    const {
      adminExtra,
      url: { webUrl },
    } = config
    const { from, BASE_API, GATEWAY } = env

    // Define the base injectData object
    const injectData: any = {
      LOGIN_BG: adminExtra.background,
      WEB_URL: webUrl,
    }

    // Determine the base API URL
    const baseApiUrl =
      BASE_API || `location.origin + '${!isDev ? `/api/v${API_VERSION}` : ''}'`

    // Determine the gateway URL
    const gatewayUrl = GATEWAY || 'location.origin'

    // Construct the script content
    const scriptContent = `
        window.pageSource = '${from ?? 'server'}';
        window.injectData = ${JSON.stringify(injectData)};
        window.injectData.BASE_API = '${baseApiUrl}';
        window.injectData.GATEWAY = '${gatewayUrl}';
        window.injectData.INIT = ${await this.userService.hasMaster()}
    `

    // Replace placeholder in the HTML entry
    return htmlEntry.replace(
      `<!-- injectable script -->`,
      `<script>${scriptContent}</script>`,
    )
  }

  rewriteAdminEntryAssetPath(htmlEntry: string) {
    if (!htmlEntry) {
      throw new InternalServerErrorException('htmlEntry is empty')
    }
    const dom = parseHTML(htmlEntry)
    const window = dom.window
    const document = window.document
    const $scripts = document.querySelectorAll(
      'script[src]',
    ) as NodeListOf<HTMLScriptElement>
    const $links = document.querySelectorAll(
      'link[href]',
    ) as NodeListOf<HTMLLinkElement>

    const urlReplacer = (__url: string) => {
      let url: URL
      try {
        const isValidUrl = new URL(__url)
        url = isValidUrl
      } catch {
        url = new URL(__url, 'http://localhost')
      }
      return url
    }

    $scripts.forEach(($script) => {
      // FIXME cannot get src attar.
      // @see https://github.com/WebReflection/linkedom/issues/143
      const originSrc = $script.src

      const url = urlReplacer(originSrc)

      $script.src = path.join('/proxy', url.pathname)
    })
    $links.forEach(($link) => {
      const originHref = $link.href

      const url = urlReplacer(originHref)
      $link.href = path.join('/proxy', url.pathname)
    })
    return dom.document.toString()
  }

  async getUrlFromConfig() {
    const config = await this.configs.waitForConfigReady()
    const url = config.url

    return {
      BASE_API: isDev ? '/' : `/api/v${API_VERSION}`,

      // BASE_API: url.serverUrl || (isDev ? '/' : '/api/v2'),
      GATEWAY: url.wsUrl,
    }
  }

  async getUrls() {
    return this.configs.get('url')
  }
}

export interface IInjectableData {
  BASE_API: null | string
  WEB_URL: null | string
  GATEWAY: null | string
  LOGIN_BG: null | string
  TITLE: null | string

  INIT: null | boolean
}
