import { Controller, Get, Scope } from '@nestjs/common'

import { Auth } from '~/common/decorator/auth.decorator'

import type { PTYService } from './pty.service'

@Auth()
@Controller({ path: 'pty', scope: Scope.REQUEST })
export class PTYController {
  constructor(private readonly service: PTYService) {}

  @Get('/record')
  async getPtyLoginRecord() {
    return this.service.getLoginRecord()
  }
}
