/* eslint-disable dot-notation */
// @reference https://github.com/ever-co/ever-gauzy/blob/d36b4f40b1446f3c33d02e0ba00b53a83109d950/packages/core/src/core/context/request-context.ts
import type { ServerResponse } from 'node:http'
import { UnauthorizedException } from '@nestjs/common'
import type { UserModel } from '~/modules/user/user.model'
import type { BizIncomingMessage } from '~/transformers/get-req.transformer'
import * as cls from 'cls-hooked'

type Nullable<T> = T | null
export class RequestContext {
  readonly id: number
  request: BizIncomingMessage
  response: ServerResponse

  constructor(request: BizIncomingMessage, response: ServerResponse) {
    this.id = Math.random()
    this.request = request
    this.response = response
  }

  static currentRequestContext(): Nullable<RequestContext> {
    const session = cls.getNamespace(RequestContext.name)
    if (session && session.active) {
      return session.get(RequestContext.name)
    }

    return null
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
