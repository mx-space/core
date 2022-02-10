import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { instanceToPlain } from 'class-transformer'
import { Auth } from '~/common/decorator/auth.decorator'
import {
  EmailService,
  EmailTemplateRenderProps,
  ReplyMailType,
} from '~/processors/helper/helper.email.service'
import { IConfig } from '../configs/configs.interface'
import { ConfigsService } from '../configs/configs.service'
import { ConfigKeyDto } from './dtos/config.dto'
import { ReplyEmailBodyDto, ReplyEmailTypeDto } from './dtos/email.dto'

@Controller(['options', 'config', 'setting', 'configs', 'option'])
@ApiTags('Option Routes')
@Auth()
export class OptionController {
  constructor(
    private readonly configsService: ConfigsService,
    private readonly configs: ConfigsService,
    private readonly emailService: EmailService,
  ) {}

  @Get('/')
  getOption() {
    return instanceToPlain(this.configs.getConfig())
  }

  @Get('/:key')
  async getOptionKey(@Param('key') key: keyof IConfig) {
    if (typeof key !== 'string' && !key) {
      throw new UnprocessableEntityException(
        'key must be IConfigKeys, got ' + key,
      )
    }
    const value = await this.configs.get(key)
    if (!value) {
      throw new BadRequestException('key is not exists.')
    }
    return { data: instanceToPlain(value) }
  }

  @Patch('/:key')
  patch(@Param() params: ConfigKeyDto, @Body() body: Record<string, any>) {
    if (typeof body !== 'object') {
      throw new UnprocessableEntityException('body must be object')
    }
    return this.configsService.patchAndValid(params.key, body)
  }

  @Get('/email/template/reply')
  async getEmailReplyTemplate(@Query() { type }: ReplyEmailTypeDto) {
    const template = await this.emailService.readTemplate(
      type === 'guest' ? ReplyMailType.Guest : ReplyMailType.Owner,
    )
    return {
      template,
      props: {
        author: '评论人Kemmer',
        link: 'https://example.com',
        mail: 'example@example.com',
        text: '这是一段回复评论',
        title: '文章的标题',
        time: '2020/01/01',
        master: '你的名字',
        ip: '0.0.0.0',
      } as EmailTemplateRenderProps,
    }
  }

  @Put('/email/template/reply')
  writeEmailReplyTemplate(
    @Query() { type }: ReplyEmailTypeDto,
    @Body() body: ReplyEmailBodyDto,
  ) {
    this.emailService.writeTemplate(
      type === 'guest' ? ReplyMailType.Guest : ReplyMailType.Owner,
      body.source,
    )
    return {
      source: body.source,
    }
  }

  @Delete('/email/template/reply')
  async deleteEmailReplyTemplate(@Query() { type }: ReplyEmailTypeDto) {
    await this.emailService.deleteTemplate(type)
    return
  }
}
