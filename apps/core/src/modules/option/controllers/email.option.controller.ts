import type {
  CommentEmailTemplateRenderProps,
  NewsletterTemplateRenderProps,
} from '~/processors/helper/helper.email.service'

import {
  BadRequestException,
  Body,
  Delete,
  Get,
  Put,
  Query,
} from '@nestjs/common'

import {
  EmailService,
  NewsletterMailType,
  ReplyMailType,
} from '~/processors/helper/helper.email.service'

import { EmailTemplateTypeDto, ReplyEmailBodyDto } from '../dtoes/email.dto'
import { OptionController } from '../option.decorator'

@OptionController('Email', 'email')
export class EmailOptionController {
  constructor(private readonly emailService: EmailService) {}
  @Get('/template')
  async getEmailReplyTemplate(@Query() { type }: EmailTemplateTypeDto) {
    let template: string
    switch (type) {
      case ReplyMailType.Guest:
        template = await this.emailService.readTemplate(ReplyMailType.Guest)
        break
      case ReplyMailType.Owner:
        template = await this.emailService.readTemplate(ReplyMailType.Owner)
        break
      case NewsletterMailType.Newsletter:
        template = await this.emailService.readTemplate(
          NewsletterMailType.Newsletter,
        )
        break
      default:
        throw new BadRequestException('Invalid email template type')
    }

    const props = {}

    switch (type) {
      case ReplyMailType.Guest:
      case ReplyMailType.Owner:
        Object.assign(props, {
          author: '评论人 Kemmer',
          link: 'https://example.com',
          mail: 'example@example.com',
          text: '这是一段回复评论',
          title: '文章的标题',
          time: '2020/01/01',
          master: '站点主人',
          ip: '0.0.0.0',
        } as CommentEmailTemplateRenderProps)
        break
      case NewsletterMailType.Newsletter:
        Object.assign(props, {
          title: '文章的标题',
          unsubscribe_link: '#unsubscribe_link',
          detail_link: '#detail_link',
          text: '正文',
          author: '作者',
          master: '站点主人',
        } as NewsletterTemplateRenderProps)
        break
    }

    return {
      template,
      props,
    }
  }

  @Put('/template')
  async writeEmailReplyTemplate(
    @Query() { type }: EmailTemplateTypeDto,
    @Body() body: ReplyEmailBodyDto,
  ) {
    await this.emailService.writeTemplate(type, body.source)
    return {
      source: body.source,
    }
  }

  @Delete('/template')
  async deleteEmailReplyTemplate(@Query() { type }: EmailTemplateTypeDto) {
    await this.emailService.deleteTemplate(type)
    return
  }
}
