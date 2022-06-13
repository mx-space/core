import { Controller, Get } from '@nestjs/common'

import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'

@ApiName
@Controller('/')
export class RenderEjsController {
  @Get('*')
  @HTTPDecorators.Bypass
  render() {
    return 'ok'
  }
}
