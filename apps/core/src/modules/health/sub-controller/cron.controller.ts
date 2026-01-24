import { Get, Param, Post } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SchedulerRegistry } from '@nestjs/schedule'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { CRON_DESCRIPTION } from '~/constants/meta.constant'
import { SCHEDULE_CRON_OPTIONS } from '~/constants/system.constant'
import { CronService } from '~/processors/helper/helper.cron.service'
import { TaskQueueService } from '~/processors/helper/helper.tq.service'
import { isString } from '~/utils/validator.util'
import { isFunction } from 'es-toolkit/compat'

@ApiController('health/cron')
@Auth()
export class HealthCronController {
  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private readonly cronService: CronService,
    private readonly reflector: Reflector,
    private readonly taskQueue: TaskQueueService,
  ) {}
  @Get('/')
  @HTTPDecorators.Bypass
  async getAllCron() {
    const cron = Object.getPrototypeOf(this.cronService)
    const keys = Object.getOwnPropertyNames(cron).slice(1)
    const map = {}
    for (const key of keys) {
      const method = cron[key]
      if (!isFunction(method)) {
        continue
      }
      const options = this.reflector.get(SCHEDULE_CRON_OPTIONS, method)
      const description = this.reflector.get(CRON_DESCRIPTION, method) || ''
      const job = this.schedulerRegistry.getCronJob(options.name)
      map[key] = {
        ...options,
        description,
        lastDate: job?.lastDate() || null,
        nextDate: job?.nextDate() || null,
        status: job?.isActive ? 'running' : 'stopped',
      }
    }

    return map
  }

  @Post('/run/:name')
  async runCron(@Param('name') name: string) {
    if (!isString(name)) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'name must be string',
      )
    }
    const cron = Object.getPrototypeOf(this.cronService)
    const keys = Object.getOwnPropertyNames(cron).slice(1)
    const hasMethod = keys.find((key) => key === name)
    if (!hasMethod) {
      throw new BizException(ErrorCodeEnum.CronNotFound, name)
    }
    const method = cron[name]
    if (!isFunction(method)) {
      throw new BizException(ErrorCodeEnum.InvalidCronMethod, name)
    }
    this.taskQueue.add(name, async () => method.call(this.cronService))
  }

  @Get('/task/:name')
  async getCronTaskStatus(@Param('name') name: string) {
    if (!isString(name)) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'name must be string',
      )
    }
    const task = await this.taskQueue.get(name)
    if (!task) {
      throw new BizException(ErrorCodeEnum.CronNotFound, name)
    }

    return task
  }
}
