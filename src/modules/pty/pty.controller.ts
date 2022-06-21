import { Get } from '@nestjs/common'

import { ApiController } from '~/common/decorator/api-controller.decorator'
import { Auth } from '~/common/decorator/auth.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'

import { PTYService } from './pty.service'

@ApiName
@Auth()
@ApiController({ path: 'pty' })
export class PTYController {
  constructor(private readonly service: PTYService) {}

  @Get('/record')
  async getPtyLoginRecord() {
    return this.service.getLoginRecord()
  }
}
