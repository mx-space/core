import { FastifyReply } from 'fastify'
import { isFunction, isString } from 'lodash'
import { resolve } from 'path'
import { Readable } from 'stream'

import {
  BadRequestException,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UnprocessableEntityException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SchedulerRegistry } from '@nestjs/schedule'

import { ApiController } from '~/common/decorator/api-controller.decorator'
import { Auth } from '~/common/decorator/auth.decorator'
import { BanInDemo } from '~/common/decorator/demo.decorator'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { CRON_DESCRIPTION } from '~/constants/meta.constant'
import { LOG_DIR } from '~/constants/path.constant'
import { SCHEDULE_CRON_OPTIONS } from '~/constants/system.constant'
import { getTodayLogFilePath } from '~/global/consola.global'
import { CronService } from '~/processors/helper/helper.cron.service'
import { TaskQueueService } from '~/processors/helper/helper.tq.service'
import { formatByteSize } from '~/utils'

import { LogQueryDto, LogTypeDto } from './health.dto'

@ApiController({
  path: 'health',
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
  @BanInDemo
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
    const task = await this.taskQueue.get(name)
    if (!task) {
      throw new BadRequestException(`${name} is not a cron in task queue`)
    }

    return task
  }

  @Get('/log/list/:type')
  async getPM2List(@Param() params: LogTypeDto) {
    const { type } = params
    let logDir: string

    switch (type) {
      case 'native':
        logDir = LOG_DIR
        break
      case 'pm2':
        logDir = resolve(os.homedir(), '.pm2', 'logs')
        break
    }

    if (!fs.pathExistsSync(logDir)) {
      throw new BadRequestException('log dir not exists')
    }
    const files = await fs.readdir(logDir)
    const allFile = [] as string[]
    switch (type) {
      case 'pm2':
        for (const file of files) {
          if (file.startsWith('mx-server-') && file.endsWith('.log')) {
            allFile.push(file)
          }
        }
        break
      case 'native':
        allFile.push(...files)
        break
    }
    const res = [] as {
      size: string
      filename: string
      type: string
      index: number
    }[]
    for (const [i, file] of Object.entries(allFile)) {
      const byteSize = fs.statSync(path.join(logDir, file)).size
      const size = formatByteSize(byteSize)
      let index: number
      let _type: string

      switch (type) {
        case 'pm2':
          _type = file.split('-')[2].split('.')[0]
          index = parseInt(file.split('-')[3], 10) || 0
          break
        case 'native':
          _type = 'log'
          index = +i
          break
      }
      res.push({ size, filename: file, index, type: _type })
    }

    return res
  }

  @Get('/log/:type')
  @HTTPDecorators.Bypass
  async getLog(
    @Query() query: LogQueryDto,
    @Param() params: LogTypeDto,
    @Res() reply: FastifyReply,
  ) {
    const { type: logType } = params
    let stream: Readable
    switch (logType) {
      case 'pm2': {
        const { index, type = 'out', filename: __filename } = query
        const logDir = resolve(os.homedir(), '.pm2', 'logs')

        if (!fs.pathExistsSync(logDir)) {
          throw new BadRequestException('log dir not exists')
        }
        const filename =
          __filename ?? `mx-server-${type}${index === 0 ? '' : `-${index}`}.log`
        const logPath = path.join(logDir, filename)
        if (!fs.existsSync(logPath)) {
          throw new BadRequestException('log file not exists')
        }
        stream = fs.createReadStream(logPath, {
          encoding: 'utf8',
        })

        break
      }
      case 'native': {
        const { filename } = query
        const logDir = LOG_DIR
        if (!filename) {
          throw new UnprocessableEntityException('filename must be string')
        }

        stream = fs.createReadStream(path.join(logDir, filename), {
          encoding: 'utf-8',
        })

        break
      }
    }
    reply.type('text/plain')
    reply.send(stream)
  }

  @Delete('/log/:type')
  async deleteLog(@Param() params: LogTypeDto, @Query() query: LogQueryDto) {
    const { type } = params
    const { filename } = query

    switch (type) {
      case 'native': {
        const logPath = path.join(LOG_DIR, filename)
        const todayLogFile = getTodayLogFilePath()

        if (logPath.endsWith('error.log') || todayLogFile === logPath) {
          await fs.writeFile(logPath, '', { encoding: 'utf8', flag: 'w' })
          break
        }
        await fs.rm(logPath)
        break
      }
      case 'pm2': {
        const logDir = resolve(os.homedir(), '.pm2', 'logs')
        if (!fs.pathExistsSync(logDir)) {
          throw new BadRequestException('log dir not exists')
        }
        await fs.rm(path.join(logDir, filename))
        break
      }
    }
  }
}
