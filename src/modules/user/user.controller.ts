import { CacheKey, CacheTTL, Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { HttpCache } from '~/common/decorator/cache.decorator'

@ApiTags('User Routes')
@Controller(['user', 'master'])
export class UserController {
  @Get('/')
  @CacheKey('a')
  @CacheTTL(300)
  // FIXME not working
  ping() {
    return 'pong'
  }
}
