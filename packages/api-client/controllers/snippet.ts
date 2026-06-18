import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler } from '~/interfaces/request'
import { autoBind } from '~/utils/auto-bind'

import type { HTTPClient } from '../core'

declare module '@mx-space/api-client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    snippet: SnippetController<ResponseWrapper>
  }
}

export class SnippetController<ResponseWrapper> implements IController {
  base = 'snippets'
  name = 'snippet'

  constructor(protected client: HTTPClient) {
    autoBind(this)
  }

  get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  // getById(id: string) {
  //   return this.proxy(id).get<Omit<SnippetModel, 'data'>>()
  // }

  getByPath<T = unknown>(path: string) {
    return this.proxy('by-path').get<T>({ params: { path } })
  }
}
