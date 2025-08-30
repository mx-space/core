import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler } from '~/interfaces/request'
import { autoBind } from '~/utils/auto-bind'
import type { HTTPClient } from '../core'
import type { AIDeepReadingModel, AISummaryModel } from '../models/ai'

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
}
