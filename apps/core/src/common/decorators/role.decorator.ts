import type { ExecutionContext } from '@nestjs/common'
import { createParamDecorator } from '@nestjs/common'
import { isTest } from '~/global/env.global'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

export const IsGuest = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = getNestExecutionContextRequest(ctx)
    return request.isGuest ?? !request.hasReaderIdentity
  },
)

export const HasAdminAccess = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = getNestExecutionContextRequest(ctx)
    if (typeof request.hasAdminAccess === 'boolean') {
      return request.hasAdminAccess
    }

    if (typeof request.isAuthenticated === 'boolean') {
      return request.isAuthenticated
    }

    return !!(isTest ? request.headers['test-token'] : false)
  },
)

export const HasReaderIdentity = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = getNestExecutionContextRequest(ctx)
    return request.hasReaderIdentity ?? !!request.readerId
  },
)
