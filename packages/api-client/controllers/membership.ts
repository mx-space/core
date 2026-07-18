import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler } from '~/interfaces/request'
import type {
  MembershipCheckoutResult,
  MembershipPlan,
  MembershipStatusResult,
} from '~/models/membership'
import { autoBind } from '~/utils/auto-bind'

import type { HTTPClient } from '../core'

declare module '@mx-space/api-client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    membership: MembershipController<ResponseWrapper>
  }
}

export class MembershipController<ResponseWrapper> implements IController {
  base = 'membership'
  name = 'membership'

  constructor(protected client: HTTPClient) {
    autoBind(this)
  }

  public get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  checkout(plan: MembershipPlan) {
    return this.proxy.checkout.post<MembershipCheckoutResult>({
      data: { plan },
    })
  }

  status() {
    return this.proxy.status.get<MembershipStatusResult>()
  }
}
