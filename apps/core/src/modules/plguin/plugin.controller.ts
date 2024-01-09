import { Get, Req } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'

import { ApiController } from '~/common/decorators/api-controller.decorator'

@ApiController('plugins')
export class PluginController {
  constructor(private readonly moduleRef: ModuleRef) {}

  @Get('/')
  async test(@Req() req: any) {}
}
