import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler } from '~/interfaces/request'
import type { HTTPClient } from '../core'
import type { AISummaryModel } from '../models/ai'

import { autoBind } from '~/utils/auto-bind'

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

  async getSummary(articleId: string, lang = 'zh-CN') {
    return this.proxy.summary(articleId).get<AISummaryModel>({
      params: {
        lang,
      },
    })
  }

  async generateSummary(articleId: string, lang = 'zh-CN') {
    return this.proxy('generate-summary').post<AISummaryModel>({
      data: {
        lang,
        refId: articleId,
      },
    })
  }
}
