import { parseHTML } from 'linkedom'
import { URL } from 'url'

import { Injectable, InternalServerErrorException } from '@nestjs/common'

import PKG from '~/../package.json'
import { API_VERSION } from '~/app.config'

import { ConfigsService } from '../configs/configs.service'

@Injectable()
export class PageProxyService {
  constructor(private readonly configs: ConfigsService) {}

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
    // tag_name: v3.6.x
    const { tag_name } = await fetch(
      `https://api.github.com/repos/${PKG.dashboard.repo}/releases/latest`,
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

    return htmlEntry.replace(
      `<!-- injectable script -->`,
      `<script>${`window.pageSource='${
        from ?? 'server'
      }';\nwindow.injectData = ${JSON.stringify({
        LOGIN_BG: adminExtra.background,
        TITLE: adminExtra.title,
        WEB_URL: webUrl,
      } as IInjectableData)}`}
     ${
       BASE_API
         ? `window.injectData.BASE_API = '${BASE_API}'`
         : `window.injectData.BASE_API = location.origin + '${
             !isDev ? `/api/v${API_VERSION}` : ''
           }';`
     }
      ${
        GATEWAY
          ? `window.injectData.GATEWAY = '${GATEWAY}';`
          : `window.injectData.GATEWAY = location.origin;`
      }
      </script>`,
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
      BASE_API: url.serverUrl || (isDev ? '/' : '/api/v2'),
      GATEWAY: url.wsUrl || '/',
    }
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
