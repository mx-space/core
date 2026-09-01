import { Body, Delete, Get, Put, Query } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { EmailService } from '~/processors/helper/helper.email.service'

import { OptionController } from '../option.decorator'
import {
  type EmailTemplateBodyDto,
  EmailTemplateBodySchema,
  type EmailTemplateTypeDto,
  EmailTemplateTypeSchema,
} from '../option.schema'

@OptionController('Email', 'email')
export class EmailOptionController {
  constructor(private readonly emailService: EmailService) {}

  @Get('/template')
  async getEmailTemplate(
    @Query({ schema: EmailTemplateTypeSchema }) { type }: EmailTemplateTypeDto,
  ) {
    const template = await this.emailService.readTemplate(type).catch(() => {
      // TODO: discriminate by exception type
      return ''
    })

    if (!template)
      throw createAppException(AppErrorCode.EMAIL_TEMPLATE_NOT_FOUND)

    const props = this.emailService.getExampleRenderProps(type)

    return {
      template,
      props,
    }
  }

  @Put('/template')
  async overrideEmailTemplate(
    @Query({ schema: EmailTemplateTypeSchema }) { type }: EmailTemplateTypeDto,
    @Body({ schema: EmailTemplateBodySchema }) body: EmailTemplateBodyDto,
  ) {
    await this.emailService.writeTemplate(type, body.source)
    return {
      source: body.source,
    }
  }

  @Delete('/template')
  async deleteEmailTemplate(
    @Query({ schema: EmailTemplateTypeSchema }) { type }: EmailTemplateTypeDto,
  ) {
    await this.emailService.deleteTemplate(type)
    return
  }
}
