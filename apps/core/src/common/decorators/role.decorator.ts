import type { ExecutionContext } from '@nestjs/common'

import { createParamDecorator } from '@nestjs/common'

import { isTest } from '~/global/env.global'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

export const IsGuest = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = getNestExecutionContextRequest(ctx)
    return request.isGuest
  },
)

export const IsAuthenticated = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = getNestExecutionContextRequest(ctx)
    // FIXME Why can't access `isMaster` in vitest test? request instance is not the same?
    return request.isMaster || (isTest ? request.headers['test-token'] : false)
  },
)
