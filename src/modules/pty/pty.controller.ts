import { Controller, Get, Scope } from '@nestjs/common'

import { Auth } from '~/common/decorator/auth.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'

import { PTYService } from './pty.service'

@ApiName
@Auth()
@Controller({ path: 'pty', scope: Scope.REQUEST })
export class PTYController {
  constructor(private readonly service: PTYService) {}

  @Get('/record')
  async getPtyLoginRecord() {
    return this.service.getLoginRecord()
  }
}
