import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler } from '~/interfaces/request'
import { autoBind } from '~/utils/auto-bind'
import type { HTTPClient } from '../core'
import type {
  AIDeepReadingModel,
  AISummaryModel,
  AITranslationModel,
} from '../models/ai'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    ai: AIController<ResponseWrapper>
  }
}

/**
 * @support core >= 5.6.0
 */
export class AIController<ResponseWrapper> implements IController {
  base = 'ai'
  name = 'ai'

  constructor(private client: HTTPClient) {
    autoBind(this)
  }

  public get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  async getSummary({
    articleId,
    lang = 'zh-CN',
    onlyDb,
  }: {
    articleId: string
    lang?: string
    onlyDb?: boolean
  }) {
    return this.proxy.summaries.article(articleId).get<AISummaryModel>({
      params: {
        lang,
        onlyDb,
      },
    })
  }

  async generateSummary(articleId: string, lang = 'zh-CN', token = '') {
    return this.proxy.summaries.generate.post<AISummaryModel>({
      params: {
        token,
      },
      data: {
        lang,
        refId: articleId,
      },
    })
  }

  /**
   * Core >= 8.3.0
   * @param articleId
   */
  async getDeepReading(articleId: string) {
    return this.proxy('deep-readings')
      .article(articleId)
      .get<AIDeepReadingModel>()
  }

  /**
   * Get translation for an article
   * @support core >= 9.4.0
   */
  async getTranslation({
    articleId,
    lang,
  }: {
    articleId: string
    lang: string
  }) {
    return this.proxy.translations.article(articleId).get<AITranslationModel>({
      params: { lang },
    })
  }

  /**
   * Get available translation languages for an article
   * @support core >= 9.4.0
   */
  async getAvailableLanguages(articleId: string) {
    return this.proxy.translations.article(articleId).languages.get<string[]>()
  }

  /**
   * Get URL for streaming summary generation (SSE)
   *
   * @see AISummaryStreamEvent for event types
   * @support core >= 9.4.0
   */
  getSummaryGenerateUrl({
    articleId,
    lang,
  }: {
    articleId: string
    lang?: string
  }): string {
    const baseUrl = this.client.endpoint
    const params = new URLSearchParams()
    if (lang) params.set('lang', lang)
    const query = params.toString()
    return `${baseUrl}/${this.base}/summaries/article/${articleId}/generate${query ? `?${query}` : ''}`
  }

  /**
   * Stream summary generation using fetch
   *
   * @see AISummaryStreamEvent for event types
   * @support core >= 9.4.0
   */
  async streamSummaryGenerate(
    {
      articleId,
      lang,
    }: {
      articleId: string
      lang?: string
    },
    fetchOptions?: RequestInit,
  ): Promise<Response> {
    const url = this.getSummaryGenerateUrl({ articleId, lang })
    return fetch(url, {
      ...fetchOptions,
      headers: {
        Accept: 'text/event-stream',
        ...fetchOptions?.headers,
      },
    })
  }

  /**
   * Get URL for streaming translation generation (SSE)
   *
   * @see AITranslationStreamEvent for event types
   * @support core >= 9.4.0
   */
  getTranslationGenerateUrl({
    articleId,
    lang,
  }: {
    articleId: string
    lang: string
  }): string {
    const baseUrl = this.client.endpoint
    const params = new URLSearchParams()
    params.set('lang', lang)
    return `${baseUrl}/${this.base}/translations/article/${articleId}/generate?${params.toString()}`
  }

  /**
   * Stream translation generation using fetch
   *
   * @see AITranslationStreamEvent for event types
   * @support core >= 9.4.0
   */
  async streamTranslationGenerate(
    {
      articleId,
      lang,
    }: {
      articleId: string
      lang: string
    },
    fetchOptions?: RequestInit,
  ): Promise<Response> {
    const url = this.getTranslationGenerateUrl({ articleId, lang })
    return fetch(url, {
      ...fetchOptions,
      headers: {
        Accept: 'text/event-stream',
        ...fetchOptions?.headers,
      },
    })
  }
}
