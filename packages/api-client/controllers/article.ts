import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler } from '~/interfaces/request'
import type {
  ArticleBodyLine,
  ArticleBodyRequestItem,
} from '~/models/article-body'
import { autoBind } from '~/utils/auto-bind'
import { camelcaseKeys } from '~/utils/camelcase-keys'
import { parseNdjsonText, readNdjsonStream } from '~/utils/ndjson'
import { resolveFullPath } from '~/utils/path'

import type { HTTPClient } from '../core/client'
import { RequestError } from '../core/error'

declare module '@mx-space/api-client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    article: ArticleController<ResponseWrapper>
  }
}

export interface StreamArticleBodiesOptions {
  headers?: HeadersInit
  lang?: string
  onLine?: (line: ArticleBodyLine) => void | Promise<void>
  signal?: AbortSignal
}

/**
 * `POST /articles/bodies` — NDJSON stream of persistable article bodies.
 * Uses `globalThis.fetch` so lines can arrive before the response completes.
 * Adaptor-based `proxy` would buffer the whole payload as text.
 *
 * @support core article-body module
 */
export class ArticleController<ResponseWrapper> implements IController {
  base = 'articles'
  name = 'article'

  constructor(private client: HTTPClient) {
    autoBind(this)
  }

  public get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  async streamBodies(
    items: ArticleBodyRequestItem[],
    options: StreamArticleBodiesOptions = {},
  ): Promise<ArticleBodyLine[]> {
    const path = '/articles/bodies'
    const url = new URL(resolveFullPath(this.client.endpoint, path))
    if (options.lang) url.searchParams.set('lang', options.lang)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/x-ndjson, application/json',
        'content-type': 'application/json',
        ...normalizeHeaders(options.headers),
      },
      body: JSON.stringify({ items }),
      signal: options.signal,
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new RequestError(
        detail || `HTTP ${response.status} ${path}`,
        response.status,
        url.toString(),
        response,
        response.status,
      )
    }

    const lines: ArticleBodyLine[] = []
    const emit = async (raw: unknown) => {
      const line = camelcaseKeys(raw) as ArticleBodyLine
      await options.onLine?.(line)
      lines.push(line)
    }

    if (response.body) {
      for await (const raw of readNdjsonStream(response.body)) {
        await emit(raw)
      }
      return lines
    }

    for (const raw of parseNdjsonText(await response.text())) {
      await emit(raw)
    }
    return lines
  }
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {}
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }
  return { ...headers }
}
