import { Get } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { EmailService } from '~/processors/helper/helper.email.service'

@ApiController('health')
export class HealthController {
  constructor(private readonly emailService: EmailService) {}

  @Get('/')
  @HTTPDecorators.Bypass
  @HttpCache({
    disable: true,
  })
  async check() {
    // TODO
    return 'OK'
  }

  @Get('/email/test')
  @Auth()
  async testEmail() {
    return this.emailService.sendTestEmail().catch((error) => {
      return {
        message: error.message,
        trace: error.stack,
      }
    })
  }
}
