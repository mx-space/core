import { inspect } from 'node:util'

import { Injectable, Logger } from '@nestjs/common'
import { $Fetch, createFetch, FetchOptions } from 'ofetch'
import pc from 'picocolors'
import { Agent } from 'undici'

import { DEBUG_MODE } from '~/app.config'
import { isDev } from '~/global/env.global'
import { PKG } from '~/utils/pkg.util'

const DEFAULT_UA = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.55 Safari/537.36 MX-Space/${PKG.version}`

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_RETRIES = 5

const devInsecureDispatcher = isDev
  ? new Agent({ connect: { rejectUnauthorized: false } })
  : undefined

@Injectable()
export class HttpService {
  private readonly logger = new Logger(HttpService.name)
  private readonly instance: $Fetch

  constructor() {
    this.instance = this.createInstance()
  }

  get fetch(): $Fetch {
    return this.instance
  }

  private createInstance(): $Fetch {
    const requestStartAt = new WeakMap<object, number>()
    const debugEnabled = DEBUG_MODE.httpRequestVerbose

    const defaults: FetchOptions = {
      timeout: DEFAULT_TIMEOUT_MS,
      retry: DEFAULT_RETRIES,
      retryDelay: ({ options }) => {
        const attempt =
          DEFAULT_RETRIES - ((options.retry as number | undefined) ?? 0)
        return Math.min(1000 * 2 ** attempt, 30_000)
      },
      dispatcher: devInsecureDispatcher,
      headers: {
        'user-agent': DEFAULT_UA,
      },
      onRequest: (ctx) => {
        requestStartAt.set(ctx.options, Date.now())
        if (!debugEnabled) return
        this.logger.log(
          `HTTP Request: [${(ctx.options.method || 'GET').toUpperCase()}] ${String(ctx.request)}
query: ${this.prettyStringify(ctx.options.query)}
body: ${this.prettyStringify(ctx.options.body)}`,
        )
      },
      onResponse: (ctx) => {
        if (!debugEnabled) return
        const startedAt = requestStartAt.get(ctx.options)
        const duration = startedAt ? Date.now() - startedAt : 0
        this.logger.log(
          `HTTP Response ${String(ctx.request)} +${duration}ms:\n${this.prettyStringify(ctx.response?._data)}`,
        )
      },
      onRequestError: (ctx) => {
        this.logger.warn(
          `HTTP Retry: [${(ctx.options.method || 'GET').toUpperCase()}] ${String(ctx.request)} — ${ctx.error?.message ?? 'network error'}`,
        )
      },
      onResponseError: (ctx) => {
        const res = ctx.response
        if (!res) {
          this.logger.error(
            `HTTP Response Failed ${String(ctx.request)}, Network Error: ${ctx.error?.message ?? 'unknown'}`,
          )
          return
        }
        this.logger.error(
          pc.red(
            `HTTP Response Failed ${String(ctx.request)} ${res.status}\n${this.prettyStringify(res._data)}`,
          ),
        )
      },
    }

    return createFetch({ defaults })
  }

  private prettyStringify(data: unknown) {
    return inspect(data, { colors: true })
  }
}
