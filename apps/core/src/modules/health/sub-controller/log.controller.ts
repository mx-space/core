import { createReadStream, existsSync } from 'node:fs'
import { stat as fsStat, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  BadRequestException,
  Delete,
  Get,
  Param,
  Query,
  Res,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { LOG_DIR } from '~/constants/path.constant'
import type { AdapterResponse } from '~/types/request'
import { getTodayLogFilePath } from '~/utils/path.util'
import { formatByteSize } from '~/utils/system.util'
import type { Readable } from 'form-data'
import { LogQueryDto, LogTypeDto } from '../health.schema'

@ApiController('health/log')
@Auth()
export class HealthLogController {
  @Get('/list/:type')
  async getPM2List(@Param() params: LogTypeDto) {
    const { type } = params
    let logDir: string

    switch (type) {
      case 'native':
        logDir = LOG_DIR
        break
      case 'pm2':
        logDir = path.resolve(os.homedir(), '.pm2', 'logs')
        break
    }

    if (!existsSync(logDir)) {
      throw new BadRequestException('log dir not exists')
    }
    const files = await readdir(logDir)
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
      created: number
    }[]
    for (const [i, file] of Object.entries(allFile)) {
      const fileStat = await fsStat(path.join(logDir, file))
      const byteSize = fileStat.size

      const size = formatByteSize(byteSize)
      let index: number
      let _type: string

      switch (type) {
        case 'pm2':
          _type = file.split('-')[2].split('.')[0]
          index = Number.parseInt(file.split('-')[3], 10) || 0
          break
        case 'native':
          _type = 'log'
          index = +i
          break
      }
      res.push({
        size,
        filename: file,
        index,
        type: _type,
        created: fileStat.ctimeMs,
      })
    }

    return res.sort((a, b) => b.created - a.created)
  }

  @Get('/:type')
  @HTTPDecorators.Bypass
  async getLog(
    @Query() query: LogQueryDto,
    @Param() params: LogTypeDto,
    @Res() reply: AdapterResponse,
  ) {
    const { type: logType } = params
    let stream: Readable
    switch (logType) {
      case 'pm2': {
        const { index, type = 'out', filename: __filename } = query
        const logDir = path.resolve(os.homedir(), '.pm2', 'logs')

        if (!existsSync(logDir)) {
          throw new BadRequestException('log dir not exists')
        }
        const filename =
          __filename ?? `mx-server-${type}${index === 0 ? '' : `-${index}`}.log`
        const logPath = path.join(logDir, filename)
        if (!existsSync(logPath)) {
          throw new BadRequestException('log file not exists')
        }

        stream = createReadStream(logPath, {
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

        stream = createReadStream(path.join(logDir, filename), {
          encoding: 'utf-8',
        })

        break
      }
    }
    reply.type('text/plain')
    return reply.send(stream)
  }

  @Delete('/:type')
  async deleteLog(@Param() params: LogTypeDto, @Query() query: LogQueryDto) {
    const { type } = params
    const { filename } = query

    if (!filename) {
      throw new UnprocessableEntityException('filename must be string')
    }

    switch (type) {
      case 'native': {
        const logPath = path.join(LOG_DIR, filename)
        const todayLogFile = getTodayLogFilePath()

        if (logPath.endsWith('error.log') || todayLogFile === logPath) {
          await writeFile(logPath, '', { encoding: 'utf8', flag: 'w' })
          break
        }
        await rm(logPath)
        break
      }
      case 'pm2': {
        const logDir = path.resolve(os.homedir(), '.pm2', 'logs')
        if (!existsSync(logDir)) {
          throw new BadRequestException('log dir not exists')
        }
        await rm(path.join(logDir, filename))
        break
      }
    }
  }
}
