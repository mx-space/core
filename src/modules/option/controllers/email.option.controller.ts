import { Body, Delete, Get, Put, Query } from '@nestjs/common'

import {
  CommentEmailTemplateRenderProps,
  EmailService,
  ReplyMailType,
} from '~/processors/helper/helper.email.service'

import { ReplyEmailBodyDto, ReplyEmailTypeDto } from '../dtos/email.dto'
import { OptionController } from '../option.decorator'

@OptionController('Email', 'email')
export class EmailOptionController {
  constructor(private readonly emailService: EmailService) {}
  @Get('/template/reply')
  async getEmailReplyTemplate(@Query() { type }: ReplyEmailTypeDto) {
    const template = await this.emailService.readTemplate(
      type === 'guest' ? ReplyMailType.Guest : ReplyMailType.Owner,
    )
    return {
      template,
      props: {
        author: '评论人 Kemmer',
        link: 'https://example.com',
        mail: 'example@example.com',
        text: '这是一段回复评论',
        title: '文章的标题',
        time: '2020/01/01',
        master: '你的名字',
        ip: '0.0.0.0',
      } as CommentEmailTemplateRenderProps,
    }
  }

  @Put('/template/reply')
  async writeEmailReplyTemplate(
    @Query() { type }: ReplyEmailTypeDto,
    @Body() body: ReplyEmailBodyDto,
  ) {
    await this.emailService.writeTemplate(
      type === 'guest' ? ReplyMailType.Guest : ReplyMailType.Owner,
      body.source,
    )
    return {
      source: body.source,
    }
  }

  @Delete('/template/reply')
  async deleteEmailReplyTemplate(@Query() { type }: ReplyEmailTypeDto) {
    await this.emailService.deleteTemplate(type)
    return
  }
}
