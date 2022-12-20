import { IRequestAdapter } from '~/interfaces/adapter'
import { IController } from '~/interfaces/controller'
import { IRequestHandler } from '~/interfaces/request'
import { TopicModel } from '~/models/topic'
import { autoBind } from '~/utils/auto-bind'

import { HTTPClient } from '../core'
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
