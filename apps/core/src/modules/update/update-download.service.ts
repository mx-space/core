import { Injectable } from '@nestjs/common'
import { HttpService } from '~/processors/helper/helper.http.service'
import axios, { AxiosRequestConfig } from 'axios'
import pc from 'picocolors'
import { ConfigsService } from '../configs/configs.service'

interface DownloadMirror {
  name: string
  urlTransform: (url: string) => string
  priority: number
}

@Injectable()
export class UpdateDownloadService {
  private readonly DOWNLOAD_TIMEOUT = 300000
  private readonly MAX_RETRIES = 3

  private readonly downloadMirrors: DownloadMirror[] = [
    {
      name: 'GhFast',
      urlTransform: (url: string) => `https://ghfast.top/${url}`,
      priority: 0,
    },
    {
      name: 'GitHub Direct',
      urlTransform: (url: string) => url,
      priority: 1,
    },
    {
      name: 'XMLY Proxy',
      urlTransform: (url: string) => `https://gh.xmly.dev/${url}`,
      priority: 2,
    },
    {
      name: 'FastGit',
      urlTransform: (url: string) =>
        url.replace('github.com', 'download.fastgit.org'),
      priority: 3,
    },
    {
      name: 'JSDeliver',
      urlTransform: (url: string) => {
        const match = url.match(
          /github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/(.+)/,
        )
        if (match) {
          const [, owner, repoName, tag, filename] = match
          return `https://cdn.jsdelivr.net/gh/${owner}/${repoName}@${tag}/${filename}`
        }
        return url
      },
      priority: 4,
    },
  ]

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigsService,
  ) {}

  async fetchWithRetry(
    url: string,
    config: AxiosRequestConfig = {},
    retries = this.MAX_RETRIES,
  ): Promise<any> {
    const { githubToken } = await this.configService.get(
      'thirdPartyServiceIntegration',
    )
    const token = githubToken || process.env.GITHUB_TOKEN
    const headers = {
      ...config.headers,
      ...(token && { Authorization: `Bearer ${token}` }),
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.httpService.axiosRef.get(url, {
          timeout: this.DOWNLOAD_TIMEOUT,
          ...config,
          headers,
        })
        return response.data
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)

        if (attempt === retries) {
          let finalMsg = `Failed after ${retries} attempts: ${errorMsg}`
          if (axios.isAxiosError(error) && error.response?.status === 403) {
            finalMsg +=
              ' (API Rate Limit Exceeded. Please configure GitHub Token in settings or env GITHUB_TOKEN)'
          }
          throw new Error(finalMsg, { cause: error })
        }

        const delay = Math.min(1000 * 2 ** (attempt - 1), 10000)
        await this.sleep(delay)
      }
    }
  }

  async downloadWithMirrors(
    originalUrl: string,
    expectedSize: number,
    pushProgress: (msg: string) => Promise<void>,
  ): Promise<ArrayBuffer | null> {
    const sortedMirrors = [...this.downloadMirrors].sort(
      (a, b) => a.priority - b.priority,
    )

    for (const mirror of sortedMirrors) {
      try {
        const mirrorUrl = mirror.urlTransform(originalUrl)
        await pushProgress(`Trying ${mirror.name}: ${mirrorUrl}\n`)

        const buffer = await this.downloadWithProgress(mirrorUrl, pushProgress)

        if (buffer && buffer.byteLength === expectedSize) {
          await pushProgress(
            pc.green(`Successfully downloaded from ${mirror.name}\n`),
          )
          return buffer
        } else {
          await pushProgress(
            pc.yellow(
              `Size mismatch from ${mirror.name}, trying next mirror...\n`,
            ),
          )
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        await pushProgress(pc.yellow(`${mirror.name} failed: ${errorMsg}\n`))
        continue
      }
    }

    return null
  }

  private async downloadWithProgress(
    url: string,
    pushProgress: (msg: string) => Promise<void>,
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Download timeout'))
      }, this.DOWNLOAD_TIMEOUT)

      axios
        .get(url, {
          responseType: 'arraybuffer',
          timeout: this.DOWNLOAD_TIMEOUT,
          onDownloadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentage = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total,
              )
              const downloaded = this.formatBytes(progressEvent.loaded)
              const total = this.formatBytes(progressEvent.total)
              pushProgress(
                `Download progress: ${percentage}% (${downloaded}/${total})\n`,
              ).catch(() => {})
            }
          },
        })
        .then((response) => {
          clearTimeout(timeout)
          resolve(response.data as ArrayBuffer)
        })
        .catch((error) => {
          clearTimeout(timeout)
          reject(error)
        })
    })
  }

  formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const dm = Math.max(decimals, 0)
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
