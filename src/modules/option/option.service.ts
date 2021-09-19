import { BadRequestException, Injectable, ValidationPipe } from '@nestjs/common'
import camelcaseKeys from 'camelcase-keys'
import { ClassConstructor, plainToClass } from 'class-transformer'
import { validateSync, ValidatorOptions } from 'class-validator'
import { CronService } from '~/processors/helper/helper.cron.service'
import { EmailService } from '~/processors/helper/helper.email.service'
import * as optionDtos from '../configs/configs.dto'
import { AlgoliaSearchOptionsDto, MailOptionsDto } from '../configs/configs.dto'
import { IConfig } from '../configs/configs.interface'
import { ConfigsService } from '../configs/configs.service'

const map: Record<string, any> = Object.entries(optionDtos).reduce(
  (obj, [key, value]) => ({
    ...obj,
    [`${key.charAt(0).toLowerCase() + key.slice(1).replace(/Dto$/, '')}`]:
      value,
  }),
  {},
)

@Injectable()
export class OptionService {
  constructor(
    private readonly configs: ConfigsService,
    private readonly emailService: EmailService,
    private readonly cronService: CronService,
  ) {}

  validOptions: ValidatorOptions = {
    whitelist: true,
    forbidNonWhitelisted: true,
  }
  validate = new ValidationPipe(this.validOptions)
  patchAndValid(key: keyof IConfig, value: any) {
    value = camelcaseKeys(value, { deep: true })

    switch (key) {
      case 'mailOptions': {
        this.validWithDto(MailOptionsDto, value)
        const task = this.configs.patch('mailOptions', value)
        task.then((dto) => {
          // re-init after set email option
          this.emailService.init()
        })
        return task
      }

      case 'algoliaSearchOptions': {
        return this.configs
          .patch(
            'algoliaSearchOptions',
            this.validWithDto(AlgoliaSearchOptionsDto, value),
          )
          .then((r) => {
            this.cronService.pushToAlgoliaSearch()
            return r
          })
      }
      default: {
        const dto = map[key]
        if (!dto) {
          throw new BadRequestException('设置不存在')
        }
        return this.configs.patch(key, this.validWithDto(dto, value))
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
    return validModel
  }
}
