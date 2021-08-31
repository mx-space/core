import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { UserService } from '../user/user.service'

@Controller({
  path: '/init',
})
@ApiTags('Init Routes')
export class InitController {
  constructor(private readonly userService: UserService) {}

  @Get('/')
  async isInit() {
    return {
      isInit: await this.userService.hasMaster(),
    }
  }
}
