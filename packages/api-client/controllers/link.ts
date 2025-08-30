import type { IRequestAdapter } from '~/interfaces/adapter'
import type { LinkModel } from '~/models/link'
import { autoBind } from '~/utils/auto-bind'
import type { HTTPClient } from '../core'
import { BaseCrudController } from './base'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    link: LinkController<ResponseWrapper>
    friend: LinkController<ResponseWrapper>
  }
}

export class LinkController<ResponseWrapper> extends BaseCrudController<
  LinkModel,
  ResponseWrapper
> {
  constructor(protected readonly client: HTTPClient) {
    super(client)
    autoBind(this)
  }

  // 是否可以申请友链
  async canApplyLink() {
    const { can } = await this.proxy.audit.get<{ can: boolean }>()
    return can
  }

  // 申请友链
  async applyLink(
    data: Pick<
      LinkModel,
      'avatar' | 'name' | 'description' | 'url' | 'email'
    > & {
      author: string
    },
  ) {
    return await this.proxy.audit.post<never>({ data })
  }

  name = ['link', 'friend']
  base = 'links'
}
