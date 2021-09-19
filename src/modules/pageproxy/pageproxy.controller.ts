import { Controller, Get, Header } from '@nestjs/common'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'

@Controller()
@ApiName
export class PageProxyController {
  @Get('/admin')
  @Header('Content-Type', 'text/html')
  @HTTPDecorators.Bypass
  proxyAdmin() {
    return ''
  }
}
