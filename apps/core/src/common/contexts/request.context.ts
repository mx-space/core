import { AsyncLocalStorage } from 'node:async_hooks'
import type { ServerResponse } from 'node:http'
import { UnauthorizedException } from '@nestjs/common'
import type { SessionUser } from '~/modules/auth/auth.types'
import type { BizIncomingMessage } from '~/transformers/get-req.transformer'

type Nullable<T> = T | null

export class RequestContext {
  private static readonly storage = new AsyncLocalStorage<RequestContext>()

  readonly id: number
  request: BizIncomingMessage
  response: ServerResponse
  lang?: string

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
    return RequestContext.currentRequestContext()?.request ?? null
  }

  static currentUser(throwError?: boolean): Nullable<SessionUser> {
    const user = RequestContext.currentRequestContext()?.request.user

    if (user) {
      return user
    }

    if (throwError) {
      throw new UnauthorizedException()
    }

    return null
  }

  static currentIsAuthenticated(): boolean {
    const request = RequestContext.currentRequestContext()?.request
    return !!request?.isAuthenticated
  }

  static currentLang(): string | undefined {
    return RequestContext.currentRequestContext()?.lang
  }
}
