import { createHash } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { FetchError, FetchOptions, ofetch } from 'ofetch'
import pc from 'picocolors'

import { HttpService } from '~/processors/helper/helper.http.service'
import { formatByteSize } from '~/utils/system.util'
import { sleep } from '~/utils/tool.util'

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
    config: FetchOptions = {},
    retries = this.MAX_RETRIES,
  ): Promise<any> {
    const isGitHubApiRequest = this.shouldAttachGitHubAuth(url)
    const thirdParty = await this.configService.get(
      'thirdPartyServiceIntegration',
    )
    const githubToken = thirdParty?.github?.token
    const token = githubToken || process.env.GITHUB_TOKEN
    const headers = {
      ...(config.headers as Record<string, string> | undefined),
      ...(token && isGitHubApiRequest && { Authorization: `Bearer ${token}` }),
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.httpService.fetch(url, {
          timeout: this.DOWNLOAD_TIMEOUT,
          retry: 0,
          ...config,
          headers,
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)

        if (attempt === retries) {
          let finalMsg = `Failed after ${retries} attempts: ${errorMsg}`
          if (
            isGitHubApiRequest &&
            error instanceof FetchError &&
            error.response?.status === 403
          ) {
            finalMsg +=
              ' (API Rate Limit Exceeded. Please configure GitHub Token in settings or env GITHUB_TOKEN)'
          }
          throw new Error(finalMsg, { cause: error })
        }

        const delay = Math.min(1000 * 2 ** (attempt - 1), 10000)
        await sleep(delay)
      }
    }
  }

  private shouldAttachGitHubAuth(url: string) {
    try {
      return new URL(url).hostname === 'api.github.com'
    } catch {
      return false
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

  async downloadDirect(
    url: string,
    pushProgress: (msg: string) => Promise<void>,
    opts: { sha256?: string } = {},
  ): Promise<ArrayBuffer> {
    await pushProgress(`Downloading ${url}\n`)
    const buffer = await this.downloadWithProgress(url, pushProgress)
    if (opts.sha256) {
      const actual = createHash('sha256')
        .update(Buffer.from(buffer))
        .digest('hex')
      if (actual !== opts.sha256.toLowerCase()) {
        throw new Error(
          `Checksum mismatch: expected sha256 ${opts.sha256}, got ${actual}`,
        )
      }
      await pushProgress(pc.green('Checksum verified.\n'))
    }
    return buffer
  }

  private async downloadWithProgress(
    url: string,
    pushProgress: (msg: string) => Promise<void>,
  ): Promise<ArrayBuffer> {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort(new Error('Download timeout'))
    }, this.DOWNLOAD_TIMEOUT)

    try {
      const response = await ofetch.raw(url, {
        responseType: 'stream',
        signal: controller.signal,
        retry: 0,
      })

      const body = response.body as ReadableStream<Uint8Array> | null
      if (!body) {
        throw new Error('Empty response body')
      }

      const total = Number(response.headers.get('content-length')) || 0
      const reader = body.getReader()
      const chunks: Uint8Array[] = []
      let loaded = 0
      let lastReportedPercent = -1

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value) continue

        chunks.push(value)
        loaded += value.byteLength

        if (total) {
          const percent = Math.floor((loaded * 100) / total)
          if (percent !== lastReportedPercent) {
            lastReportedPercent = percent
            const downloaded = formatByteSize(loaded)
            const totalStr = formatByteSize(total)
            pushProgress(
              `Download progress: ${percent}% (${downloaded}/${totalStr})\n`,
            ).catch(() => {})
          }
        }
      }

      const merged = new Uint8Array(loaded)
      let offset = 0
      for (const chunk of chunks) {
        merged.set(chunk, offset)
        offset += chunk.byteLength
      }
      return merged.buffer
    } finally {
      clearTimeout(timeout)
    }
  }
}
