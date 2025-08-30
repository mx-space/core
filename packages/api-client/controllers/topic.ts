import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler } from '~/interfaces/request'
import type { TopicModel } from '~/models/topic'
import { autoBind } from '~/utils/auto-bind'
import type { HTTPClient } from '../core'
import { BaseCrudController } from './base'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    topic: TopicController<ResponseWrapper>
  }
}

export class TopicController<ResponseWrapper>
  extends BaseCrudController<TopicModel, ResponseWrapper>
  implements IController
{
  base = 'topics'
  name = 'topic'

  constructor(protected client: HTTPClient) {
    super(client)
    autoBind(this)
  }

  public get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  getTopicBySlug(slug: string) {
    return this.proxy.slug(slug).get<TopicModel>()
  }
}
