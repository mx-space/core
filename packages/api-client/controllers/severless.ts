import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler } from '~/interfaces/request'
import { autoBind } from '~/utils/auto-bind'
import type { HTTPClient } from '../core'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    serverless: ServerlessController<ResponseWrapper>
  }
}

export class ServerlessController<ResponseWrapper> implements IController {
  base = 'serverless'
  name = 'serverless'

  constructor(protected client: HTTPClient) {
    autoBind(this)
  }

  get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  getByReferenceAndName<T = unknown>(reference: string, name: string) {
    return this.proxy(reference)(name).get<T>()
  }
}
