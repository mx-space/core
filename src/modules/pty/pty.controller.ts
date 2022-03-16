import { Controller, Get, Scope } from '@nestjs/common'
import { PTYService } from './pty.service'
import { Auth } from '~/common/decorator/auth.decorator'

@Auth()
@Controller({ path: 'pty', scope: Scope.REQUEST })
export class PTYController {
  constructor(private readonly service: PTYService) {}

  @Get('/record')
  async getPtyLoginRecord() {
    return this.service.getLoginRecord()
  }
}
