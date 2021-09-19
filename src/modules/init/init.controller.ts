import { Controller, Get, Scope } from '@nestjs/common'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { UserService } from '../user/user.service'

@Controller({
  path: '/init',
  scope: Scope.REQUEST,
})
@ApiName
export class InitController {
  constructor(private readonly userService: UserService) {}

  @Get('/')
  async isInit() {
    return {
      isInit: await this.userService.hasMaster(),
    }
  }
}
