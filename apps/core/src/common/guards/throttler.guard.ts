import type { ExecutionContext } from '@nestjs/common'

import { Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

@Injectable()
export class ExtendThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = getNestExecutionContextRequest(context)

    if (req.user) {
      return true
    }
    return super.canActivate(context)
  }
}
