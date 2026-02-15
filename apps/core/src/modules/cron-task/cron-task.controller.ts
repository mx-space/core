import { Get, Param, Post } from '@nestjs/common'
import { BaseTaskController } from '~/common/controllers/base-task.controller'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import type { ScopedTaskService } from '~/processors/task-queue'
import { StringIdDto } from '~/shared/dto/id.dto'
import { isString } from '~/utils/validator.util'
import { CronTaskService } from './cron-task.service'
import { CronTaskType, type CronTaskTypeValue } from './cron-task.types'

@ApiController('cron-task')
@Auth()
export class CronDefinitionController {
  constructor(private readonly cronTaskService: CronTaskService) {}

  @Get('/')
  @HTTPDecorators.Bypass
  async getCronDefinitions() {
    return this.cronTaskService.getCronDefinitions()
  }

  @Post('/run/:type')
  async runCronTask(@Param('type') type: string) {
    if (!isString(type)) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'type must be string',
      )
    }

    const validTypes = Object.values(CronTaskType) as string[]
    if (!validTypes.includes(type)) {
      throw new BizException(ErrorCodeEnum.CronNotFound, type)
    }

    return this.cronTaskService.createCronTask(type as CronTaskTypeValue)
  }
}

@ApiController('cron-task/tasks')
@Auth()
export class CronTaskController extends BaseTaskController {
  constructor(private readonly cronTaskService: CronTaskService) {
    super()
  }

  protected get taskCrudService(): ScopedTaskService {
    return this.cronTaskService.crud
  }

  @Post('/:id/retry')
  @Auth()
  override async retryTask(@Param() params: StringIdDto) {
    return this.cronTaskService.crud.retryTask(params.id, (task) =>
      this.cronTaskService.createCronTask(task.type as CronTaskTypeValue),
    )
  }
}
