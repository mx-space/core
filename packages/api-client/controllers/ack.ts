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
    ack: AckController<ResponseWrapper>
  }
}

/**
 * @support core >= 4.4.0
 */
export class AckController<ResponseWrapper> implements IController {
  base = 'ack'
  name = 'ack'

  constructor(private client: HTTPClient) {
    autoBind(this)
  }

  public get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  read(type: 'post' | 'note', id: string) {
    return this.proxy.post<never>({
      data: {
        type: 'read',
        payload: {
          type,
          id,
        },
      },
    })
  }
}
