/*
 * @Author: Innei
 * @Date: 2020-05-08 20:01:58
 * @LastEditTime: 2021-01-15 14:12:43
 * @LastEditors: Innei
 * @FilePath: /server/apps/server/src/shared/options/options.service.ts
 * @Coding with Love
 */

import {
  Injectable,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common'
import { ClassConstructor, plainToClass } from 'class-transformer'
import { validateSync, ValidatorOptions } from 'class-validator'
import { EmailService } from '~/processors/helper/helper.email.service'
import {
  BackupOptions,
  BaiduSearchOptions,
  CommentOptions,
  MailOptionsDto,
  SEODto,
  UrlDto,
} from '../configs/configs.dto'
import { IConfig } from '../configs/configs.interface'
import { ConfigsService } from '../configs/configs.service'

@Injectable()
export class OptionService {
  constructor(
    private readonly configs: ConfigsService,
    private readonly emailService: EmailService,
  ) {}

  validOptions: ValidatorOptions = {
    whitelist: true,
    forbidNonWhitelisted: true,
  }
  validate = new ValidationPipe(this.validOptions)
  patchAndValid(key: keyof IConfig, value: any) {
    switch (key) {
      case 'url': {
        this.validWithDto(UrlDto, value)
        return this.configs.patch('url', value)
      }
      case 'commentOptions': {
        this.validWithDto(CommentOptions, value)
        return this.configs.patch('commentOptions', value)
      }

      case 'mailOptions': {
        this.validWithDto(MailOptionsDto, value)
        const task = this.configs.patch('mailOptions', value)
        task.then((dto) => {
          // re-init after set email option
          this.emailService.init()
        })
        return task
      }
      case 'seo': {
        this.validWithDto(SEODto, value)
        return this.configs.patch('seo', value)
      }
      case 'backupOptions': {
        this.validWithDto(BackupOptions, value)
        return this.configs.patch('backupOptions', value)
      }
      case 'baiduSearchOptions': {
        this.validWithDto(BaiduSearchOptions, value)

        return this.configs.patch('baiduSearchOptions', value)
      }
      default: {
        throw new UnprocessableEntityException('设置不存在')
      }
    }
  }

  private validWithDto<T extends object>(dto: ClassConstructor<T>, value: any) {
    const validModel = plainToClass(dto, value)
    const errors = validateSync(validModel, this.validOptions)
    if (errors.length > 0) {
      const error = this.validate.createExceptionFactory()(errors as any[])
      throw error
    }
    return true
  }
}
