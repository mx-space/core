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
import { OptionService } from './option.service'

@Controller(['options', 'config', 'setting', 'configs', 'option'])
@ApiTags('Option Routes')
@Auth()
export class OptionController {
  constructor(
    private readonly optionService: OptionService,
    private readonly configs: ConfigsService,
    private readonly emailService: EmailService,
  ) {}

  @Get('/')
  getOption() {
    return this.configs.getConfig()
  }

  @Get('/:key')
  getOptionKey(@Param('key') key: keyof IConfig) {
    if (typeof key !== 'string' && !key) {
      throw new UnprocessableEntityException(
        'key must be IConfigKeys, got ' + key,
      )
    }
    const value = this.configs.get(key)
    if (!value) {
      throw new BadRequestException('key is not exists.')
    }
    return { data: value }
  }

  @Patch('/:key')
  patch(@Param() params: ConfigKeyDto, @Body() body: Record<string, any>) {
    if (typeof body !== 'object') {
      throw new UnprocessableEntityException('body must be object')
    }
    return this.optionService.patchAndValid(params.key, body)
  }

  @Get('/email/template/reply')
  async getEmailReplyTemplate(@Query() { type }: ReplyEmailTypeDto) {
    const template = await this.emailService.readTemplate(
      type === 'guest' ? ReplyMailType.Guest : ReplyMailType.Owner,
    )
    return {
      template,
      props: {
        author: '作者 Author',
        link: 'https://example.com',
        mail: 'example@example.com',
        text: '这是一段回复评论',
        title: '标题',
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
