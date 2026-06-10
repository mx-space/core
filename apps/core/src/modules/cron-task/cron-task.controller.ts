import { Get, Param, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { isString } from '~/utils/validator.util'

import { CronTaskService } from './cron-task.service'
import { CronTaskType, type CronTaskTypeValue } from './cron-task.types'

@ApiController('cron-task')
@Auth()
export class CronDefinitionController {
  constructor(private readonly cronTaskService: CronTaskService) {}

  @Get('/')
  async getCronDefinitions() {
    return this.cronTaskService.getCronDefinitions()
  }

  @Post('/run/:type')
  async runCronTask(@Param('type') type: string) {
    if (!isString(type)) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'type must be string',
      })
    }

    const validTypes = Object.values(CronTaskType) as string[]
    if (!validTypes.includes(type)) {
      throw createAppException(AppErrorCode.CRON_NOT_FOUND, { extra: type })
    }

    return this.cronTaskService.createCronTask(type as CronTaskTypeValue)
  }
}
