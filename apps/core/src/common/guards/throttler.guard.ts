import type { ExecutionContext } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'
import type { FastifyBizRequest } from '~/transformers/get-req.transformer'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'
import { getIp } from '~/utils/ip.util'

@Injectable()
export class ExtendThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = getNestExecutionContextRequest(context)

    if (req.user) {
      return true
    }
    return super.shouldSkip(context)
  }

  protected async getTracker(req: FastifyBizRequest) {
    return getIp(req.raw)
  }
}
