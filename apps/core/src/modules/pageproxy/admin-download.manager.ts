import { Injectable } from '@nestjs/common'
import { AssetService } from '~/processors/helper/helper.asset.service'
import ejs from 'ejs'
import { Observable } from 'rxjs'
import { UpdateService } from '../update/update.service'

interface DownloadState {
  observer: Observable<string> | null
  logs: string[]
  errorMsg: string | null
  isDownloading: boolean
  startTime: number
  lastActivity: number
}

export interface DownloadResponse {
  code: number
  type?: 'text/html'
  body?: string
}

@Injectable()
export class AdminDownloadManager {
  private state: DownloadState = {
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
    private readonly updateService: UpdateService,
    private readonly assetService: AssetService,
  ) {}

  handleLogPolling(): DownloadResponse {
    this.checkTimeout()

    if (this.state.errorMsg) {
      const errorMsg = this.state.errorMsg
      this.state.errorMsg = null
      return {
        code: 500,
        type: 'text/html',
        body: `
          <div style="color: red; font-weight: bold;">
            Download Failed: ${errorMsg}
          </div>
          <div style="margin-top: 10px;">
            <button onclick="window.location.reload()">Retry Download</button>
          </div>
        `,
      }
    }

    if (!this.state.isDownloading && this.state.logs.length === 0) {
      return { code: 204 }
    }

    if (this.state.logs.length > 0) {
      const log = this.state.logs.shift() || '...'
      this.state.lastActivity = Date.now()
      return { code: 200, type: 'text/html', body: log }
    }

    return { code: 200, type: 'text/html', body: '...' }
  }

  async handleDownloadStart(): Promise<DownloadResponse> {
    const message = this.state.isDownloading
      ? 'Download already in progress...'
      : 'Starting download...'

    if (!this.state.isDownloading) {
      this.startDownload()
    }

    const html = await this.renderDownloadPage(message)
    return { code: 404, type: 'text/html', body: html }
  }

  private startDownload(): void {
    this.initialize()

    this.updateService
      .getLatestAdminVersion()
      .then((version) => {
        this.state.observer = this.updateService.downloadAdminAsset(version)
        this.setupSubscription()
      })
      .catch((error) => {
        this.state.errorMsg = error.message
        this.state.isDownloading = false
      })
  }

  private async renderDownloadPage(initialMessage: string): Promise<string> {
    try {
      const template = (await this.assetService.getAsset(
        '/render/download-admin.ejs',
        {
          encoding: 'utf-8',
        },
      )) as string
      return ejs.render(template, { initialMessage })
    } catch {
      return `
        <h1>Downloading Admin Assets...</h1>
        <p>${initialMessage}</p>
        <p>Please wait or refresh.</p>
      `
    }
  }

  private checkTimeout(): void {
    if (
      this.state.isDownloading &&
      Date.now() - this.state.lastActivity > this.DOWNLOAD_TIMEOUT
    ) {
      this.cleanup()
      this.state.errorMsg = 'Download timeout - no activity for 10 minutes'
    }
  }

  private initialize(): void {
    this.state = {
      observer: null,
      logs: [],
      errorMsg: null,
      isDownloading: true,
      startTime: Date.now(),
      lastActivity: Date.now(),
    }
  }

  private setupSubscription(): void {
    if (!this.state.observer) return

    this.state.observer.subscribe({
      next: (value) => {
        this.state.logs.push(value)
        this.state.lastActivity = Date.now()

        if (this.state.logs.length > 1000) {
          this.state.logs = this.state.logs.slice(-500)
        }
      },
      error: (err) => {
        this.state.errorMsg = err.message || String(err)
        this.cleanup()
      },
      complete: () => {
        setTimeout(() => {
          this.cleanup()
        }, 1000)
      },
    })
  }

  private cleanup(): void {
    this.state.isDownloading = false
    this.state.observer = null

    setTimeout(() => {
      this.state.logs = []
    }, this.LOG_RETENTION_TIME)
  }
}
