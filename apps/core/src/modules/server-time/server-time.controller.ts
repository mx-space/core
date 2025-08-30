import { Get } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'

@ApiController('/')
export class ServerTimeController {
  @Get('/server-time')
  @HttpCache.disable
  @HTTPDecorators.Bypass
  async serverTime() {}
}
