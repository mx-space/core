import { Body, Delete, Get, Put, Query } from '@nestjs/common'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EmailService } from '~/processors/helper/helper.email.service'
import { EmailTemplateBodyDto, EmailTemplateTypeDto } from '../dtoes/email.dto'
import { OptionController } from '../option.decorator'

@OptionController('Email', 'email')
export class EmailOptionController {
  constructor(private readonly emailService: EmailService) {}

  @Get('/template')
  async getEmailTemplate(@Query() { type }: EmailTemplateTypeDto) {
    const template = await this.emailService.readTemplate(type).catch(() => {
      // TODO  判断异常类型
      return ''
    })

    if (!template) throw new BizException(ErrorCodeEnum.EmailTemplateNotFound)

    const props = this.emailService.getExampleRenderProps(type)

    return {
      template,
      props,
    }
  }

  @Put('/template')
  async overrideEmailTemplate(
    @Query() { type }: EmailTemplateTypeDto,
    @Body() body: EmailTemplateBodyDto,
  ) {
    await this.emailService.writeTemplate(type, body.source)
    return {
      source: body.source,
    }
  }

  @Delete('/template')
  async deleteEmailTemplate(@Query() { type }: EmailTemplateTypeDto) {
    await this.emailService.deleteTemplate(type)
    return
  }
}
