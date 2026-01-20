/* eslint-disable dot-notation */
// @reference https://github.com/ever-co/ever-gauzy/blob/d36b4f40b1446f3c33d02e0ba00b53a83109d950/packages/core/src/core/context/request-context.ts
import { AsyncLocalStorage } from 'node:async_hooks'
import type { ServerResponse } from 'node:http'
import { UnauthorizedException } from '@nestjs/common'
import type { UserModel } from '~/modules/user/user.model'
import type { BizIncomingMessage } from '~/transformers/get-req.transformer'

type Nullable<T> = T | null
export class RequestContext {
  private static readonly storage = new AsyncLocalStorage<RequestContext>()

  readonly id: number
  request: BizIncomingMessage
  response: ServerResponse

  constructor(request: BizIncomingMessage, response: ServerResponse) {
    this.id = Math.random()
    this.request = request
    this.response = response
  }

  static run<T>(requestContext: RequestContext, callback: () => T): T {
    return RequestContext.storage.run(requestContext, callback)
  }

  static currentRequestContext(): Nullable<RequestContext> {
    return RequestContext.storage.getStore() ?? null
  }

  static currentRequest(): Nullable<BizIncomingMessage> {
    const requestContext = RequestContext.currentRequestContext()

    if (requestContext) {
      return requestContext.request
    }

    return null
  }

  static currentUser(throwError?: boolean): Nullable<UserModel> {
    const requestContext = RequestContext.currentRequestContext()

    if (requestContext) {
      const user = requestContext.request['user']

      if (user) {
        return user
      }
    }

    if (throwError) {
      throw new UnauthorizedException()
    }

    return null
  }

  static currentIsAuthenticated() {
    const requestContext = RequestContext.currentRequestContext()

    if (requestContext) {
      const isAuthenticated =
        requestContext.request['isAuthenticated'] ||
        requestContext.request['isAuthenticated']

      return !!isAuthenticated
    }

    return false
  }
}
