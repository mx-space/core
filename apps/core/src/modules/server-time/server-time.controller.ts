import { Get } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { RawResponse } from '~/common/response/raw-response.decorator'
import { ResponseV2 } from '~/common/response/v2-controller.decorator'

@ApiController('/')
@ResponseV2()
export class ServerTimeController {
  @Get('/server-time')
  @HttpCache.disable
  @RawResponse
  async serverTime() {}
}
