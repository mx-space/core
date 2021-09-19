import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Scope,
  UnprocessableEntityException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SchedulerRegistry } from '@nestjs/schedule'
import { isFunction, isString } from 'lodash'
import { resolve } from 'path'
import { Auth } from '~/common/decorator/auth.decorator'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { CRON_DESCRIPTION } from '~/constants/meta.constant'
import { SCHEDULE_CRON_OPTIONS } from '~/constants/system.constant'
import { CronService } from '~/processors/helper/helper.cron.service'
import { TaskQueueService } from '~/processors/helper/helper.tq.service'
import { PM2QueryDto } from './health.dto'

@Controller({
  path: 'health',
  scope: Scope.REQUEST,
})
@Auth()
@ApiName
export class HealthController {
  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private readonly cronService: CronService,
    private readonly reflector: Reflector,
    private readonly taskQueue: TaskQueueService,
  ) {}

  @Get('/cron')
  // 跳过 JSON 结构转换
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
        status: job?.running ? 'running' : 'stopped',
      }
    }

    return map
  }

  @Post('/cron/run/:name')
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

  @Get('/cron/task/:name')
  async getCronTaskStatus(@Param('name') name: string) {
    if (!isString(name)) {
      throw new BadRequestException('name must be string')
    }
    const task = this.taskQueue.get(name)
    if (!task) {
      throw new BadRequestException(`${name} is not a cron in task queue`)
    }

    return task
  }

  @Get('/log/list/pm2')
  async getPM2List() {
    const logDir = resolve(os.homedir(), '.pm2', 'logs')

    if (!fs.pathExistsSync(logDir)) {
      throw new BadRequestException('log dir not exists')
    }
    const files = fs.readdirSync(logDir)
    const arr = [] as string[]
    for (const file of files) {
      if (file.startsWith('mx-server-') && file.endsWith('.log')) {
        arr.push(file)
      }
    }
    const res = [] as {
      size: string
      filename: string
      type: string
      index: number
    }[]
    for (const file of arr) {
      const size = `${(
        fs.statSync(path.join(logDir, file)).size / 1024
      ).toFixed(2)} KiB`
      const index = parseInt(file.split('-')[3], 10) || 0
      const type = file.split('-')[2].split('.')[0]
      res.push({ size, filename: file, index, type })
    }

    return res
  }

  @Get('/log/pm2')
  async getPM2Log(@Query() query: PM2QueryDto) {
    const { index, type } = query
    const logDir = resolve(os.homedir(), '.pm2', 'logs')

    if (!fs.pathExistsSync(logDir)) {
      throw new BadRequestException('log dir not exists')
    }
    const filename = `mx-server-${type}${index === 0 ? '' : '-' + index}.log`
    const logPath = path.join(logDir, filename)
    if (!fs.existsSync(logPath)) {
      throw new BadRequestException('log file not exists')
    }
    const data = fs.readFileSync(logPath, {
      encoding: 'utf8',
    })
    return { data }
  }
}
