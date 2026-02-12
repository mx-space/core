import { access, cp, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Injectable } from '@nestjs/common'
import { LOCAL_ADMIN_ASSET_PATH } from '~/constants/path.constant'
import { HttpService } from '~/processors/helper/helper.http.service'
import { PKG } from '~/utils/pkg.util'
import axios, { AxiosRequestConfig } from 'axios'
import JSZip from 'jszip'
import pc from 'picocolors'
import { Observable } from 'rxjs'
import { catchError } from 'rxjs/operators'
import { ConfigsService } from '../configs/configs.service'

const { repo } = PKG.dashboard!

interface DownloadMirror {
  name: string
  urlTransform: (url: string) => string
  priority: number
}

@Injectable()
export class UpdateService {
  private downloadLock = false
  private readonly DOWNLOAD_TIMEOUT = 300000 // 5分钟
  private readonly MAX_RETRIES = 3

  // 镜像源配置，按优先级排序
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
        // 将 GitHub release 下载链接转换为 JSDeliver CDN 链接
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
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigsService,
  ) {}

  downloadAdminAsset(version: string) {
    const observable$ = new Observable<string>((subscriber) => {
      ;(async () => {
        // 检查下载锁
        if (this.downloadLock) {
          subscriber.next(
            pc.yellow('Another download is in progress, please wait...\n'),
          )
          subscriber.complete()
          return
        }

        this.downloadLock = true

        try {
          const endpoint = `https://api.github.com/repos/${repo}/releases/tags/v${version}`

          subscriber.next(`Getting release info from ${endpoint}.\n`)

          // 获取发布信息，带重试机制
          const releaseInfo = await this.fetchWithRetry(endpoint, {
            timeout: 30000,
            headers: {
              'User-Agent': 'Mix-Space-Admin-Updater',
              Accept: 'application/vnd.github.v3+json',
            },
          })

          if (!releaseInfo?.assets) {
            throw new Error('Release assets not found')
          }

          const asset = releaseInfo.assets.find(
            (asset: any) => asset.name === 'release.zip',
          )

          if (!asset) {
            subscriber.next(pc.red('release.zip not found in assets.\n'))
            subscriber.next(
              pc.red(
                `Available assets: ${releaseInfo.assets
                  .map((a: any) => a.name)
                  .join(', ')}\n`,
              ),
            )
            return
          }

          const downloadUrl = asset.browser_download_url
          const fileSize = asset.size

          subscriber.next(`Found release.zip (${this.formatBytes(fileSize)})\n`)

          // 尝试多个镜像源下载
          const buffer = await this.downloadWithMirrors(
            downloadUrl,
            fileSize,
            subscriber,
          )

          if (!buffer) {
            throw new Error('All download sources failed')
          }

          // 解压和安装
          await this.extractAndInstall(buffer, version, subscriber)

          subscriber.next(
            pc.green(
              `Admin asset v${version} downloaded and installed successfully.\n`,
            ),
          )
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error)
          subscriber.next(pc.red(`Download failed: ${errorMsg}\n`))

          // 清理可能的部分下载文件
          await this.cleanup().catch(() => {})
        } finally {
          this.downloadLock = false
          subscriber.complete()
        }
      })()
    })

    return observable$.pipe(
      catchError((err) => {
        this.downloadLock = false
        console.error('Download observable error:', err)
        return observable$
      }),
    )
  }

  async getLatestAdminVersion() {
    const endpoint = `https://api.github.com/repos/${repo}/releases/latest`

    try {
      const data = await this.fetchWithRetry(endpoint, {
        headers: {
          'User-Agent': 'Mix-Space-Admin-Updater',
          Accept: 'application/vnd.github.v3+json',
        },
      })

      const tag = data?.tag_name
      if (!tag) {
        throw new Error('tag_name not found in release info')
      }
      return tag.replace(/^v/, '')
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to get latest version: ${errorMsg}`)
    }
  }

  /**
   * 带重试机制的网络请求
   */
  private async fetchWithRetry(
    url: string,
    config: AxiosRequestConfig = {},
    retries = this.MAX_RETRIES,
  ): Promise<any> {
    // 获取 GitHub Token
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
          throw new Error(finalMsg)
        }

        // 指数退避
        const delay = Math.min(1000 * 2 ** (attempt - 1), 10000)
        await this.sleep(delay)
      }
    }
  }

  /**
   * 多镜像源下载
   */
  private async downloadWithMirrors(
    originalUrl: string,
    expectedSize: number,
    subscriber: any,
  ): Promise<ArrayBuffer | null> {
    const sortedMirrors = [...this.downloadMirrors].sort(
      (a, b) => a.priority - b.priority,
    )

    for (const mirror of sortedMirrors) {
      try {
        const mirrorUrl = mirror.urlTransform(originalUrl)
        subscriber.next(`Trying ${mirror.name}: ${mirrorUrl}\n`)

        const buffer = await this.downloadWithProgress(
          mirrorUrl,
          expectedSize,
          subscriber,
        )

        if (buffer && buffer.byteLength === expectedSize) {
          subscriber.next(
            pc.green(`Successfully downloaded from ${mirror.name}\n`),
          )
          return buffer
        } else {
          subscriber.next(
            pc.yellow(
              `Size mismatch from ${mirror.name}, trying next mirror...\n`,
            ),
          )
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        subscriber.next(pc.yellow(`${mirror.name} failed: ${errorMsg}\n`))
        continue
      }
    }

    return null
  }

  /**
   * 带进度显示的下载
   */
  private async downloadWithProgress(
    url: string,
    expectedSize: number,
    subscriber: any,
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
              subscriber.next(
                `Download progress: ${percentage}% (${downloaded}/${total})\n`,
              )
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

  /**
   * 解压和安装文件
   */
  private async extractAndInstall(
    buffer: ArrayBuffer,
    version: string,
    subscriber: any,
  ): Promise<void> {
    subscriber.next('Extracting archive...\n')

    // 创建临时目录
    const tempDir = `${LOCAL_ADMIN_ASSET_PATH}_temp_${Date.now()}`
    await mkdir(tempDir, { recursive: true })

    try {
      // 解压 ZIP 文件
      const zip = new JSZip()
      await zip.loadAsync(buffer)

      const files = Object.keys(zip.files)
      if (files.length === 0) {
        throw new Error('Archive is empty')
      }

      subscriber.next(`Extracting ${files.length} files...\n`)

      // 解压所有文件到临时目录
      for (const filename of files) {
        const file = zip.files[filename]
        if (!file.dir) {
          const content = await file.async('nodebuffer')
          const filePath = path.join(tempDir, filename)
          const dirPath = path.dirname(filePath)

          await mkdir(dirPath, { recursive: true })
          await writeFile(filePath, Uint8Array.from(content))
        }
      }

      // 查找实际的内容目录 (通常是 dist 目录)
      const distPath = path.join(tempDir, 'dist')
      const contentPath = await access(distPath)
        .then(() => distPath)
        .catch(() => tempDir)

      // 备份现有版本
      const backupPath = `${LOCAL_ADMIN_ASSET_PATH}_backup_${Date.now()}`
      try {
        await access(LOCAL_ADMIN_ASSET_PATH)
        await this.moveDirectory(LOCAL_ADMIN_ASSET_PATH, backupPath)
        subscriber.next('Existing version backed up.\n')
      } catch {
        // 目录不存在，无需备份
      }

      try {
        // 移动新版本到目标位置
        await this.moveDirectory(contentPath, LOCAL_ADMIN_ASSET_PATH)

        // 写入版本文件
        await writeFile(
          path.join(LOCAL_ADMIN_ASSET_PATH, 'version'),
          version,
          'utf8',
        )

        // 验证安装是否成功
        await this.verifyInstallation()

        subscriber.next(pc.green('Installation completed successfully.\n'))

        // 清理备份
        if (
          await access(backupPath)
            .then(() => true)
            .catch(() => false)
        ) {
          await rm(backupPath, { recursive: true, force: true })
        }
      } catch (installError) {
        // 安装失败，恢复备份
        if (
          await access(backupPath)
            .then(() => true)
            .catch(() => false)
        ) {
          await rm(LOCAL_ADMIN_ASSET_PATH, { recursive: true, force: true })
          await this.moveDirectory(backupPath, LOCAL_ADMIN_ASSET_PATH)
          subscriber.next(pc.yellow('Installation failed, backup restored.\n'))
        }
        throw installError
      }
    } finally {
      // 清理临时目录
      await rm(tempDir, { recursive: true, force: true })
    }
  }

  /**
   * 跨平台兼容的目录移动
   */
  private async moveDirectory(src: string, dest: string): Promise<void> {
    try {
      // 尝试原子重命名
      await rename(src, dest)
    } catch {
      // 重命名失败（可能跨分区），使用复制+删除
      await cp(src, dest, { recursive: true })
      await rm(src, { recursive: true, force: true })
    }
  }

  /**
   * 验证安装是否成功
   */
  private async verifyInstallation(): Promise<void> {
    const indexPath = path.join(LOCAL_ADMIN_ASSET_PATH, 'index.html')
    const versionPath = path.join(LOCAL_ADMIN_ASSET_PATH, 'version')

    try {
      await access(indexPath)
      await access(versionPath)
    } catch {
      throw new Error(
        'Installation verification failed: required files not found',
      )
    }
  }

  /**
   * 清理操作
   */
  private async cleanup() {
    await rm('admin-release.zip', { force: true })
  }

  /**
   * 格式化字节大小
   */
  private formatBytes(bytes: number, decimals = 2) {
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
