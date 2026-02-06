import path from 'node:path'
import { URL } from 'node:url'
import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { API_VERSION } from '~/app.config'
import { PKG } from '~/utils/pkg.util'
import { parseHTML } from 'linkedom'
import { ConfigsService } from '../configs/configs.service'
import { OwnerService } from '../owner/owner.service'

@Injectable()
export class PageProxyService {
  constructor(
    private readonly configs: ConfigsService,
    private readonly ownerService: OwnerService,
  ) {}

  async checkCanAccessAdminProxy() {
    const { adminExtra } = await this.configs.waitForConfigReady()
    return adminExtra.enableAdminProxy || isDev
  }

  /**
   * @returns {Promise<string>} version `x.y.z` , not startwith `v`
   * @throws {Error}
   */
  async getAdminLastestVersionFromGHRelease(): Promise<string> {
    const { githubToken } = await this.configs.get(
      'thirdPartyServiceIntegration',
    )
    const { tag_name } = await fetch(
      `https://api.github.com/repos/${PKG.dashboard!.repo}/releases/latest`,
      {
        headers: githubToken ? { Authorization: `Bearer ${githubToken}` } : {},
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

    const injectData: any = {
      LOGIN_BG: adminExtra.background,
      WEB_URL: webUrl,
    }

    const baseApiUrl =
      BASE_API || `location.origin + '${!isDev ? `/api/v${API_VERSION}` : ''}'`

    const gatewayUrl = GATEWAY || 'location.origin'

    const scriptContent = `
        window.pageSource = '${from ?? 'server'}';
        window.injectData = ${JSON.stringify(injectData)};
        window.injectData.BASE_API = '${baseApiUrl}';
        window.injectData.GATEWAY = '${gatewayUrl}';
        window.injectData.INIT = ${await this.ownerService.hasOwner()}
    `

    return htmlEntry.replace(
      `<!-- injectable script -->`,
      `<script>${scriptContent}</script>`,
    )
  }

  rewriteAdminEntryAssetPath(htmlEntry: string) {
    if (!htmlEntry) {
      throw new InternalServerErrorException('htmlEntry is empty')
    }
    const { document } = parseHTML(htmlEntry)
    const $scripts = document.querySelectorAll(
      'script[src]',
    ) as NodeListOf<HTMLScriptElement>
    const $links = document.querySelectorAll(
      'link[href]',
    ) as NodeListOf<HTMLLinkElement>

    const urlReplacer = (rawUrl: string) => {
      try {
        return new URL(rawUrl)
      } catch {
        return new URL(rawUrl, 'http://localhost')
      }
    }

    $scripts.forEach(($script) => {
      const originSrc = $script.src

      const url = urlReplacer(originSrc)

      $script.src = path.join('/proxy', url.pathname)
    })
    $links.forEach(($link) => {
      const originHref = $link.href

      const url = urlReplacer(originHref)
      $link.href = path.join('/proxy', url.pathname)
    })
    return document.toString()
  }

  async getUrlFromConfig() {
    const config = await this.configs.waitForConfigReady()
    const url = config.url

    return {
      BASE_API: isDev ? '/' : `/api/v${API_VERSION}`,
      GATEWAY: url.wsUrl,
    }
  }

  async getUrls() {
    return this.configs.get('url')
  }
}
