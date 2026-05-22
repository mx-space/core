import { Get } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { RawResponse } from '~/common/decorators/raw-response.decorator'

@ApiController('/')
export class ServerTimeController {
  @Get('/server-time')
  @HttpCache.disable
  @RawResponse
  async serverTime() {}
}
