import {
  BadRequestException,
  Get,
  Param,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SchedulerRegistry } from '@nestjs/schedule'
import { SCHEDULE_CRON_OPTIONS } from '@nestjs/schedule/dist/schedule.constants'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { CRON_DESCRIPTION } from '~/constants/meta.constant'
import { CronService } from '~/processors/helper/helper.cron.service'
import { TaskQueueService } from '~/processors/helper/helper.tq.service'
import { isString } from 'class-validator'
import { isFunction } from 'lodash'

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
      throw new UnprocessableEntityException('name must be string')
    }
    const cron = Object.getPrototypeOf(this.cronService)
    const keys = Object.getOwnPropertyNames(cron).slice(1)
    const hasMethod = keys.find((key) => key === name)
    if (!hasMethod) {
      throw new BadRequestException(`${name} is not a cron`)
    }
    this.taskQueue.add(name, async () =>
      this.cronService[name].call(this.cronService),
    )
  }

  @Get('/task/:name')
  async getCronTaskStatus(@Param('name') name: string) {
    if (!isString(name)) {
      throw new BadRequestException('name must be string')
    }
    const task = await this.taskQueue.get(name)
    if (!task) {
      throw new BadRequestException(`${name} is not a cron in task queue`)
    }

    return task
  }
}
